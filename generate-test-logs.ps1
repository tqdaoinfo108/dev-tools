# Script để tạo test logs trên Android device
param(
    [string]$DeviceId = "10AF17118C003A9"
)

Write-Host "Generating test logs on device: $DeviceId" -ForegroundColor Green

# Clear logcat buffer
Write-Host "Clearing logcat buffer..."
adb -s $DeviceId logcat -c

# Generate test logs
Write-Host "Generating test logs..."
adb -s $DeviceId shell "log -t TestApp 'Test log message 1'"
adb -s $DeviceId shell "log -t TestApp 'Test log message 2'"
adb -s $DeviceId shell "log -t TestApp 'Test log message 3'"

# Generate logs with different levels
adb -s $DeviceId shell "log -t TestApp -p i 'Info message'"
adb -s $DeviceId shell "log -t TestApp -p w 'Warning message'"
adb -s $DeviceId shell "log -t TestApp -p e 'Error message'"

Write-Host "Test logs generated successfully!" -ForegroundColor Green
Write-Host "You can now check the logcat filter tool." -ForegroundColor Yellow
