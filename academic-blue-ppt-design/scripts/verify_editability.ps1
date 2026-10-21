param([Parameter(Mandatory=$true)][string]$DeckPath,[Parameter(Mandatory=$true)][string]$OutputDir)
$ErrorActionPreference='Stop';$taskOut=[IO.Path]::GetFullPath($OutputDir);New-Item -ItemType Directory -Path $taskOut -Force | Out-Null
$taskWorking=Join-Path $taskOut 'editability-working.pptx';$taskProof=Join-Path $taskOut 'editability-proof.pptx';Copy-Item -LiteralPath $DeckPath -Destination $taskWorking -Force
$taskApp=$null;$taskPres=$null;$taskCount=0;$taskSecurity=$null;$taskTests=[Collections.Generic.List[object]]::new();$taskChanges=@{}
try{
 $taskApp=New-Object -ComObject PowerPoint.Application;$taskCount=$taskApp.Presentations.Count;$taskSecurity=$taskApp.AutomationSecurity;$taskApp.AutomationSecurity=3
 $taskPres=$taskApp.Presentations.Open($taskWorking,0,0,0)
 for($taskI=1;$taskI -le $taskPres.Slides.Count;$taskI++){foreach($taskS in $taskPres.Slides.Item($taskI).Shapes){
  if(-not $taskChanges.ContainsKey('text') -and $taskS.HasTextFrame -eq -1 -and $taskS.TextFrame.HasText -eq -1){$taskS.TextFrame.TextRange.Text='原生文字编辑验证';$taskChanges.text=@($taskI,$taskS.Name)}
  if(-not $taskChanges.ContainsKey('image') -and $taskS.Type -eq 13){$taskS.Left+=2;$taskChanges.image=@($taskI,$taskS.Name,$taskS.Left)}
  if(-not $taskChanges.ContainsKey('connector') -and $taskS.Connector -eq -1){$taskS.Left+=2;$taskChanges.connector=@($taskI,$taskS.Name,$taskS.Left)}
  if(-not $taskChanges.ContainsKey('table') -and $taskS.HasTable -eq -1){$taskS.Table.Cell(1,1).Shape.TextFrame.TextRange.Text='表格编辑验证';$taskChanges.table=@($taskI,$taskS.Name)}
  if(-not $taskChanges.ContainsKey('chart') -and $taskS.HasChart -eq -1){$taskChart=$taskS.Chart;$taskSeriesCount=$taskChart.SeriesCollection().Count;$taskChart.HasTitle=$true;$taskChart.ChartTitle.Text='图表原生标题编辑验证';$taskChanges.chart=@($taskI,$taskS.Name,$taskSeriesCount)}
 }}
 $taskPres.SaveAs($taskProof,24);$taskPres.Close();$taskPres=$null;$taskPres=$taskApp.Presentations.Open($taskProof,-1,0,0)
 foreach($taskKind in @('text','image','connector','table','chart')){
  if(-not $taskChanges.ContainsKey($taskKind)){$taskTests.Add([pscustomobject]@{kind=$taskKind;applicable=$false;reason='本成品无此对象'});continue}
  $taskC=$taskChanges[$taskKind];$taskS=$taskPres.Slides.Item($taskC[0]).Shapes.Item($taskC[1]);$taskPass=$false
  if($taskKind -eq 'text'){$taskPass=$taskS.TextFrame.TextRange.Text -eq '原生文字编辑验证'}
  if($taskKind -eq 'image'){$taskPass=[Math]::Abs($taskS.Left-$taskC[2]) -lt 0.1}
  if($taskKind -eq 'connector'){$taskPass=$taskS.Connector -eq -1 -and [Math]::Abs($taskS.Left-$taskC[2]) -lt 0.1}
  if($taskKind -eq 'table'){$taskPass=$taskS.Table.Cell(1,1).Shape.TextFrame.TextRange.Text -eq '表格编辑验证'}
  if($taskKind -eq 'chart'){$taskPass=$taskS.HasChart -eq -1 -and $taskS.Chart.ChartTitle.Text -eq '图表原生标题编辑验证' -and $taskS.Chart.SeriesCollection().Count -eq $taskC[2]}
  $taskTests.Add([pscustomobject]@{kind=$taskKind;applicable=$true;pass=$taskPass;page=$taskC[0];name=$taskC[1]})
 }
 $taskTests.ToArray() | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $taskOut 'editability.json') -Encoding utf8
 if(@($taskTests | Where-Object {$_.applicable -and -not $_.pass}).Count){throw 'Edit/save/reopen failed'}
 Write-Output ('EDITABILITY_COMPLETE '+$taskTests.Count)
}finally{if($taskPres){$taskPres.Close()};if($taskApp){if($null -ne $taskSecurity){$taskApp.AutomationSecurity=$taskSecurity};if($taskCount -eq 0){$taskApp.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskApp)}}
