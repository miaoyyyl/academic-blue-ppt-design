param([Parameter(Mandatory=$true)][string]$CasesPath,[Parameter(Mandatory=$true)][string]$OutputDir)
$ErrorActionPreference='Stop';$taskSuites=Get-Content -LiteralPath $CasesPath -Raw -Encoding UTF8 | ConvertFrom-Json
$taskOut=[IO.Path]::GetFullPath($OutputDir);New-Item -ItemType Directory -Path $taskOut -Force | Out-Null
function Find-TaskNativeShape {
 param($TaskShapes,[string]$TaskName)
 foreach($taskS in $TaskShapes){
  if($taskS.Name -eq $TaskName){return $taskS}
  if($taskS.Type -eq 6){$taskFound=Find-TaskNativeShape $taskS.GroupItems $TaskName;if($null -ne $taskFound){return $taskFound}}
 }
 return $null
}
$taskApp=$null;$taskPres=$null;$taskCount=0;$taskSecurity=$null;$taskChecks=[Collections.Generic.List[object]]::new()
try{
 $taskApp=New-Object -ComObject PowerPoint.Application;$taskCount=$taskApp.Presentations.Count;$taskSecurity=$taskApp.AutomationSecurity;$taskApp.AutomationSecurity=3
 foreach($taskSuite in $taskSuites){
  if($taskSuite.id -notmatch '^[A-Za-z0-9_-]+$'){throw 'INVALID_SUITE_ID'}
  $taskSource=(Resolve-Path -LiteralPath $taskSuite.deck).Path;$taskBefore=(Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash
  $taskWorking=Join-Path $taskOut ($taskSuite.id+'-working.pptx');$taskProof=Join-Path $taskOut ($taskSuite.id+'-proof.pptx')
  if($taskSource -eq $taskWorking -or $taskSource -eq $taskProof){throw 'SOURCE_MUST_REMAIN_SEPARATE'}
  Copy-Item -LiteralPath $taskSource -Destination $taskWorking -Force;$taskPres=$taskApp.Presentations.Open($taskWorking,0,0,0)
  $taskExpected=[Collections.Generic.List[object]]::new()
  foreach($taskCase in $taskSuite.cases){
   $taskShape=Find-TaskNativeShape $taskPres.Slides.Item([int]$taskCase.page).Shapes $taskCase.name
   if($null -eq $taskShape){throw ('NATIVE_TARGET_MISSING '+$taskCase.name)}
   if($taskCase.kind -eq 'text'){$taskValue='节点编辑验证';$taskShape.TextFrame.TextRange.Text=$taskValue}
   elseif($taskCase.kind -eq 'table'){
    if($taskShape.HasTable -ne -1){throw 'EXPECTED_NATIVE_TABLE'}
    $taskValue='单元格编辑验证';$taskShape.Table.Cell(2,1).Shape.TextFrame.TextRange.Text=$taskValue;$taskShape.Left+=2
   }
   elseif($taskCase.kind -in @('image','connector','shape')){
    if($taskCase.kind -eq 'image' -and $taskShape.Type -ne 13){throw 'EXPECTED_NATIVE_PICTURE'}
    if($taskCase.kind -eq 'connector' -and $taskShape.Connector -ne -1){throw 'EXPECTED_NATIVE_CONNECTOR'}
    if($taskCase.kind -eq 'shape' -and $taskShape.Type -notin @(1,5,6)){throw 'EXPECTED_NATIVE_SHAPE_OR_GROUP'}
    $taskShape.Left+=2;$taskValue=$taskShape.Left
   }else{throw 'UNSUPPORTED_EDIT_CASE'}
   $taskExpected.Add([pscustomobject]@{page=$taskCase.page;name=$taskCase.name;kind=$taskCase.kind;typeId=$taskCase.typeId;value=$taskValue;left=$taskShape.Left})
  }
  $taskPres.SaveAs($taskProof,24);$taskPres.Close();$taskPres=$null;$taskPres=$taskApp.Presentations.Open($taskProof,-1,0,0)
  foreach($taskCase in $taskExpected){
   $taskShape=Find-TaskNativeShape $taskPres.Slides.Item([int]$taskCase.page).Shapes $taskCase.name
   $taskPass=if($taskCase.kind -eq 'text'){$taskShape.TextFrame.TextRange.Text -eq $taskCase.value}elseif($taskCase.kind -eq 'table'){$taskShape.Table.Cell(2,1).Shape.TextFrame.TextRange.Text -eq $taskCase.value -and [Math]::Abs($taskShape.Left-$taskCase.left) -lt 0.1}else{[Math]::Abs($taskShape.Left-$taskCase.value) -lt 0.1}
   $taskChecks.Add([pscustomobject]@{suite=$taskSuite.id;page=$taskCase.page;name=$taskCase.name;kind=$taskCase.kind;typeId=$taskCase.typeId;pass=$taskPass;proof=$taskProof})
  }
  $taskPres.Close();$taskPres=$null
  if((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash -ne $taskBefore){throw 'SOURCE_CHANGED'}
 }
 $taskChecks.ToArray() | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $taskOut 'component-edits.json') -Encoding utf8
 if(@($taskChecks | Where-Object {-not $_.pass}).Count){throw 'COMPONENT_EDIT_SAVE_REOPEN_FAILED'}
 Write-Output ('COMPONENT_EDIT_COMPLETE '+$taskChecks.Count)
}finally{if($taskPres){$taskPres.Close()};if($taskApp){if($null -ne $taskSecurity){$taskApp.AutomationSecurity=$taskSecurity};if($taskCount -eq 0){$taskApp.Quit()};[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskApp)}}
exit 0
