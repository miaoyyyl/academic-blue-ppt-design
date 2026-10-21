param([Parameter(Mandatory=$true)][string]$DeckPath,[Parameter(Mandatory=$true)][string]$OutputDir,[string]$BindingsPath='',[string]$PlanPath='')
$ErrorActionPreference='Stop'
$taskDeck=(Resolve-Path -LiteralPath $DeckPath).Path
$taskOut=[IO.Path]::GetFullPath($OutputDir)
if(-not $taskDeck.EndsWith('.pptx',[StringComparison]::OrdinalIgnoreCase)){throw 'Generated PPTX required'}
New-Item -ItemType Directory -Path $taskOut -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $taskOut 'previews') -Force | Out-Null
$taskBindings=$null
if($BindingsPath){$taskBindings=Get-Content -LiteralPath $BindingsPath -Raw -Encoding UTF8 | ConvertFrom-Json}
$taskApp=$null;$taskPres=$null;$taskCount=0;$taskSecurity=$null
$taskResults=[Collections.Generic.List[object]]::new()
function Test-TaskGroupText {
 param($TaskGroup,$TaskTexts,$TaskIssues)
 foreach($taskChild in $TaskGroup.GroupItems){
  if($taskChild.Type -eq 6){Test-TaskGroupText $taskChild $TaskTexts $TaskIssues}
  if($taskChild.HasTextFrame -eq -1 -and $taskChild.TextFrame.HasText -eq -1){
   $taskRange=$taskChild.TextFrame.TextRange
   $taskAvailableH=$taskChild.Height-$taskChild.TextFrame.MarginTop-$taskChild.TextFrame.MarginBottom
   $taskAvailableW=$taskChild.Width-$taskChild.TextFrame.MarginLeft-$taskChild.TextFrame.MarginRight
   $taskFits=$taskRange.BoundHeight -le ($taskAvailableH+1.5) -and $taskRange.BoundWidth -le ($taskAvailableW+1.5)
   $TaskTexts.Add([pscustomobject]@{name=$taskChild.Name;text=$taskRange.Text;fontPt=$taskRange.Font.Size;fontName=$taskRange.Font.Name;left=$taskRange.BoundLeft;top=$taskRange.BoundTop;width=$taskRange.BoundWidth;height=$taskRange.BoundHeight;fits=$taskFits;autoSize=$taskChild.TextFrame.AutoSize;nestedGroup=$true;availableHeight=$taskAvailableH;availableWidth=$taskAvailableW})
   if(-not $taskFits){$TaskIssues.Add([pscustomobject]@{code='GROUP_TEXT_OVERFLOW';name=$taskChild.Name;neededHeight=$taskRange.BoundHeight;availableHeight=$taskAvailableH;neededWidth=$taskRange.BoundWidth;availableWidth=$taskAvailableW})}
   if($taskChild.TextFrame.AutoSize -ne 0){$TaskIssues.Add([pscustomobject]@{code='GROUP_AUTOSIZE_ENABLED';name=$taskChild.Name})}
  }
 }
}
try{
 $taskApp=New-Object -ComObject PowerPoint.Application
 $taskCount=$taskApp.Presentations.Count;$taskSecurity=$taskApp.AutomationSecurity;$taskApp.AutomationSecurity=3
 $taskPres=$taskApp.Presentations.Open($taskDeck,-1,0,0)
 $taskPres.SaveAs((Join-Path $taskOut 'presentation.pdf'),32)
 for($taskPage=1;$taskPage -le $taskPres.Slides.Count;$taskPage++){
  $taskSlide=$taskPres.Slides.Item($taskPage)
  $taskTarget=Join-Path $taskOut ('previews/slide-'+$taskPage.ToString('000')+'.png')
  $taskSlide.Export($taskTarget,'PNG',1920,1080)
  $taskIssues=[Collections.Generic.List[object]]::new();$taskTexts=[Collections.Generic.List[object]]::new();$taskObjects=[Collections.Generic.List[object]]::new()
  foreach($taskShape in $taskSlide.Shapes){
   if($taskShape.Type -eq 6){Test-TaskGroupText $taskShape $taskTexts $taskIssues}
   $taskRadians=[double]$taskShape.Rotation*[Math]::PI/180
   $taskVisualW=[Math]::Abs($taskShape.Width*[Math]::Cos($taskRadians))+[Math]::Abs($taskShape.Height*[Math]::Sin($taskRadians))
   $taskVisualH=[Math]::Abs($taskShape.Width*[Math]::Sin($taskRadians))+[Math]::Abs($taskShape.Height*[Math]::Cos($taskRadians))
   $taskVisualX=$taskShape.Left+($taskShape.Width-$taskVisualW)/2;$taskVisualY=$taskShape.Top+($taskShape.Height-$taskVisualH)/2
   $taskObjects.Add([pscustomobject]@{name=$taskShape.Name;type=$taskShape.Type;left=$taskShape.Left;top=$taskShape.Top;width=$taskShape.Width;height=$taskShape.Height;rotation=$taskShape.Rotation;visualBounds=@($taskVisualX,$taskVisualY,$taskVisualW,$taskVisualH)})
   if($taskVisualX -lt -0.5 -or $taskVisualY -lt -0.5 -or $taskVisualX+$taskVisualW -gt $taskPres.PageSetup.SlideWidth+0.5 -or $taskVisualY+$taskVisualH -gt $taskPres.PageSetup.SlideHeight+0.5){$taskIssues.Add([pscustomobject]@{code='OBJECT_OUT_OF_SLIDE';name=$taskShape.Name})}
   if($taskShape.HasTable -eq -1){
    for($taskR=1;$taskR -le $taskShape.Table.Rows.Count;$taskR++){for($taskC=1;$taskC -le $taskShape.Table.Columns.Count;$taskC++){
     try{
      $taskCell=$taskShape.Table.Cell($taskR,$taskC).Shape;$taskTR=$taskCell.TextFrame.TextRange
      $taskFits=$taskTR.BoundHeight -le ($taskCell.Height-$taskCell.TextFrame.MarginTop-$taskCell.TextFrame.MarginBottom+1.5) -and $taskTR.BoundWidth -le ($taskCell.Width-$taskCell.TextFrame.MarginLeft-$taskCell.TextFrame.MarginRight+1.5)
      $taskTexts.Add([pscustomobject]@{name=$taskShape.Name+'.cell.'+($taskR-1)+'.'+($taskC-1);text=$taskTR.Text;fontPt=$taskTR.Font.Size;fontName=$taskTR.Font.Name;left=$taskTR.BoundLeft;top=$taskTR.BoundTop;width=$taskTR.BoundWidth;height=$taskTR.BoundHeight;fits=$taskFits;autoSize=$taskCell.TextFrame.AutoSize})
      if($taskTR.Text -and -not $taskFits){$taskIssues.Add([pscustomobject]@{code='TABLE_CELL_OVERFLOW';name=$taskShape.Name;row=$taskR;column=$taskC})}
     }catch{}
    }}
   }
   if($taskShape.HasTextFrame -eq -1 -and $taskShape.TextFrame.HasText -eq -1){
    $taskTR=$taskShape.TextFrame.TextRange;$taskFits=$taskTR.BoundHeight -le ($taskShape.Height-$taskShape.TextFrame.MarginTop-$taskShape.TextFrame.MarginBottom+1.5)
    $taskTexts.Add([pscustomobject]@{name=$taskShape.Name;text=$taskTR.Text;fontPt=$taskTR.Font.Size;fontName=$taskTR.Font.Name;left=$taskTR.BoundLeft;top=$taskTR.BoundTop;width=$taskTR.BoundWidth;height=$taskTR.BoundHeight;fits=$taskFits;autoSize=$taskShape.TextFrame.AutoSize})
    if(-not $taskFits){$taskIssues.Add([pscustomobject]@{code='TEXT_OVERFLOW';name=$taskShape.Name;needed=$taskTR.BoundHeight;height=$taskShape.Height})}
    if($taskShape.TextFrame.AutoSize -ne 0){$taskIssues.Add([pscustomobject]@{code='AUTOSIZE_ENABLED';name=$taskShape.Name})}
   }
  }
  if($taskBindings){
   $taskExpected=@($taskBindings.pages | Where-Object {$_.page -eq $taskPage})[0]
   foreach($taskGroup in $taskExpected.parallelGroups){
    $taskPeer=@(foreach($taskSlot in $taskGroup.slots){$taskB=$taskExpected.bindings | Where-Object {$_.slot -eq $taskSlot} | Select-Object -First 1;$taskTexts | Where-Object {$_.name -eq $taskB.name} | Select-Object -First 1})
    if($taskPeer.Count -ne $taskGroup.slots.Count){$taskIssues.Add([pscustomobject]@{code='PEER_BINDING_MISSING';slots=$taskGroup.slots});continue}
    if($taskGroup.font -and @($taskPeer.fontPt | Sort-Object -Unique).Count -gt 1){$taskIssues.Add([pscustomobject]@{code='PEER_FONT_MISMATCH';slots=$taskGroup.slots})}
    if($taskGroup.baseline -and (($taskPeer.top | Measure-Object -Maximum).Maximum-($taskPeer.top | Measure-Object -Minimum).Minimum) -gt 1){$taskIssues.Add([pscustomobject]@{code='PEER_BASELINE_MISMATCH';slots=$taskGroup.slots})}
   }
   foreach($taskB in $taskExpected.bindings | Where-Object {$_.kind -eq 'image'}){
    $taskO=$taskObjects | Where-Object {$_.name -eq $taskB.name} | Select-Object -First 1
    if(-not $taskO){$taskIssues.Add([pscustomobject]@{code='IMAGE_BINDING_MISSING';name=$taskB.name})}
    elseif([Math]::Abs($taskO.width/$taskO.height-$taskB.bounds.width/$taskB.bounds.height) -gt 0.01){$taskIssues.Add([pscustomobject]@{code='IMAGE_ASPECT_CHANGED';name=$taskB.name})}
   }
  }
  $taskResults.Add([pscustomobject]@{page=$taskPage;nativeObjects=$taskSlide.Shapes.Count;objects=$taskObjects.ToArray();texts=$taskTexts.ToArray();issues=$taskIssues.ToArray();preview=$taskTarget})
  if($taskPage%10 -eq 0){Write-Output ('Rendered '+$taskPage+'/'+$taskPres.Slides.Count)}
 }
 $taskResults.ToArray() | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $taskOut 'powerpoint-check.json') -Encoding utf8
 $taskIssueCount=(@($taskResults | ForEach-Object {$_.issues})).Count
 Write-Output ('NATIVE_RENDER_COMPLETE pages='+$taskResults.Count+' issues='+$taskIssueCount)
 if($taskIssueCount){exit 2}
 if($PlanPath){
  if(-not $BindingsPath){throw '空间验收需要本次native-bindings.json。'}
  $taskNode=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
  & $taskNode (Join-Path $PSScriptRoot 'audit_rendered_spatial.mjs') $PlanPath $BindingsPath (Join-Path $taskOut 'powerpoint-check.json') (Join-Path $taskOut 'rendered-spatial.json')
  if($LASTEXITCODE -ne 0){throw '实际PowerPoint空间分布验收失败，查看rendered-spatial.json。'}
  $taskPython=if($env:PPT_PYTHON_EXECUTABLE){$env:PPT_PYTHON_EXECUTABLE}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'}
  & $taskPython (Join-Path $PSScriptRoot 'verify_rendered_component_polish.py') $taskDeck $PlanPath $BindingsPath (Join-Path $taskOut 'powerpoint-check.json') (Join-Path $taskOut 'rendered-component-polish.json')
  if($LASTEXITCODE -ne 0){throw '短句节点或折角标题的实际文字位置不居中，查看rendered-component-polish.json。'}
 }
}finally{
 if($taskPres){$taskPres.Close()}
 if($taskApp){if($null -ne $taskSecurity){$taskApp.AutomationSecurity=$taskSecurity};if($taskCount -eq 0){$taskApp.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskApp)}
}
exit 0
