param([Parameter(Mandatory=$true)][string]$DeckPath,[Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference='Stop';$taskApp=$null;$taskPres=$null;$taskCount=0;$taskSecurity=$null;$taskLines=[Collections.Generic.List[object]]::new();$taskOrphans=[Collections.Generic.List[object]]::new();$taskLeading=[Collections.Generic.List[object]]::new()
function Get-TaskTextItems {
 param($TaskShapes)
 foreach($taskNode in $TaskShapes){
  if($taskNode.Type -eq 6){Get-TaskTextItems $taskNode.GroupItems}
  if($taskNode.HasTable -eq -1){
   for($taskR=1;$taskR -le $taskNode.Table.Rows.Count;$taskR++){for($taskC=1;$taskC -le $taskNode.Table.Columns.Count;$taskC++){
    [pscustomobject]@{shape=$taskNode.Table.Cell($taskR,$taskC).Shape;name=$taskNode.Name+'.cell.'+($taskR-1)+'.'+($taskC-1)}
   }}
  }elseif($taskNode.HasTextFrame -eq -1){[pscustomobject]@{shape=$taskNode;name=$taskNode.Name}}
 }
}
try{
 $taskApp=New-Object -ComObject PowerPoint.Application;$taskCount=$taskApp.Presentations.Count;$taskSecurity=$taskApp.AutomationSecurity;$taskApp.AutomationSecurity=3
 $taskPres=$taskApp.Presentations.Open([IO.Path]::GetFullPath($DeckPath),-1,0,0)
 for($taskPage=1;$taskPage -le $taskPres.Slides.Count;$taskPage++){foreach($taskItem in @(Get-TaskTextItems $taskPres.Slides.Item($taskPage).Shapes)){
  $taskS=$taskItem.shape;$taskName=$taskItem.name
  if($taskS.HasTextFrame -ne -1 -or $taskS.TextFrame.HasText -ne -1){continue}
  $taskTR=$taskS.TextFrame.TextRange;$taskPrev=-1;$taskShapeLines=[Collections.Generic.List[object]]::new()
  for($taskIndex=1;$taskIndex -le 200;$taskIndex++){
   $taskLine=$taskTR.Lines($taskIndex,1);$taskStart=$taskLine.Start;$taskLength=$taskLine.Length
   if($taskLength -le 0 -or $taskStart -le $taskPrev){break};$taskPrev=$taskStart
   $taskRecord=[pscustomobject]@{index=$taskIndex;start=$taskStart;length=$taskLength;text=$taskLine.Text};$taskShapeLines.Add($taskRecord)
   $taskVisible=[regex]::Replace($taskLine.Text.Trim(),'[\u2060\u200B\uFEFF]','')
   $taskSingleCjk=$taskIndex -gt 1 -and $taskTR.Text.Length -gt 4 -and $taskTR.Font.Size -ge 16 -and $taskVisible -match '^[\u4E00-\u9FFF][。．.,，;；:：、!?！？]*$'
   if($taskVisible -match '^[。．.,，;；:：、!?！？]+$' -or $taskSingleCjk){$taskOrphans.Add([pscustomobject]@{page=$taskPage;name=$taskName;line=$taskIndex;start=$taskStart;text=$taskLine.Text;shapeText=$taskTR.Text;lines=$taskShapeLines.ToArray()})}
   if($taskVisible -match '^[\u3001\u3002\uFF0C\uFF1B\uFF1A\uFF1F\uFF01\uFF09\uFF3D\u3011\u300B\u201D\u2019\u300D\u300F\u3015\u3009\u3017]'){$taskLeading.Add([pscustomobject]@{page=$taskPage;name=$taskName;line=$taskIndex;text=$taskLine.Text;shapeText=$taskTR.Text})}
  }
  $taskLines.Add([pscustomobject]@{page=$taskPage;name=$taskName;lines=$taskShapeLines.ToArray()})
 }}
 [pscustomobject]@{pass=($taskOrphans.Count -eq 0 -and $taskLeading.Count -eq 0);pages=$taskPres.Slides.Count;orphans=$taskOrphans.ToArray();leadingPunctuation=$taskLeading.ToArray();shapes=$taskLines.ToArray()}|ConvertTo-Json -Depth 10|Set-Content -LiteralPath ([IO.Path]::GetFullPath($ReportPath)) -Encoding utf8
 Write-Output ('NATIVE_LINE_INSPECTION pages='+$taskPres.Slides.Count+' orphans='+$taskOrphans.Count+' leading='+$taskLeading.Count)
 foreach($taskO in $taskOrphans){Write-Output ('Orphan page='+$taskO.page+' name='+$taskO.name+' line='+$taskO.line+' text='+$taskO.text)}
}finally{if($taskPres){$taskPres.Close()};if($taskApp){if($null -ne $taskSecurity){$taskApp.AutomationSecurity=$taskSecurity};if($taskCount -eq 0){$taskApp.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskApp)}}
if($taskOrphans.Count -gt 0 -or $taskLeading.Count -gt 0){exit 2}
