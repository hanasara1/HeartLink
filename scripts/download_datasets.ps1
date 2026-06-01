# scripts/download_datasets.ps1
# PhysioNet 공개 데이터셋 다운로드 (Windows PowerShell)

$DataDir = if ($env:DATA_DIR) { $env:DATA_DIR } else { ".\data\raw" }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$datasets = @(
    @{ Name = "mitdb";   Url = "https://physionet.org/static/published-projects/mitdb/mit-bih-arrhythmia-database-1.0.0.zip" },
    @{ Name = "ptbxl";   Url = "https://physionet.org/static/published-projects/ptb-xl/ptb-xl-a-large-publicly-available-electrocardiography-dataset-1.0.3.zip" },
    @{ Name = "bidmc";   Url = "https://physionet.org/static/published-projects/bidmc/bidmc-ppg-and-respiration-dataset-1.0.0.zip" },
    @{ Name = "chapman"; Url = "https://physionet.org/static/published-projects/ecg-arrhythmia/a-large-scale-12-lead-electrocardiogram-database-for-arrhythmia-study-1.0.0.zip" }
)

foreach ($ds in $datasets) {
    $zipPath = Join-Path $DataDir "$($ds.Name).zip"
    Write-Host "[다운로드] $($ds.Name) ..."
    Invoke-WebRequest -Uri $ds.Url -OutFile $zipPath
    Write-Host "[압축 해제] $($ds.Name) ..."
    Expand-Archive -Path $zipPath -DestinationPath (Join-Path $DataDir $ds.Name) -Force
    Remove-Item $zipPath
}

Write-Host "완료. 다운로드 경로: $DataDir"
