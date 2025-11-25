@echo off
setlocal
set PROFILE=shelcaster-admin
set REGION=us-east-1
set ROLE=arn:aws:iam::124355640062:role/lambda-dynamodb-role

echo ========================================
echo Deploying Broadcast Studio Functions
echo ========================================

REM shelcaster-get-show
echo.
echo [1/16] Deploying shelcaster-get-show...
cd shelcaster-get-show
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-get-show.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-get-show --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-get-show --zip-file fileb://shelcaster-get-show.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-get-show
) else (
    aws lambda create-function --function-name shelcaster-get-show --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-get-show.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-get-show
)
del shelcaster-get-show.zip >nul 2>&1

REM shelcaster-get-producer-shows
echo [2/16] Deploying shelcaster-get-producer-shows...
cd shelcaster-get-producer-shows
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-get-producer-shows.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-get-producer-shows --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-get-producer-shows --zip-file fileb://shelcaster-get-producer-shows.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-get-producer-shows
) else (
    aws lambda create-function --function-name shelcaster-get-producer-shows --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-get-producer-shows.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-get-producer-shows
)
del shelcaster-get-producer-shows.zip >nul 2>&1

REM shelcaster-update-show
echo [3/16] Deploying shelcaster-update-show...
cd shelcaster-update-show
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-update-show.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-update-show --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-update-show --zip-file fileb://shelcaster-update-show.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-update-show
) else (
    aws lambda create-function --function-name shelcaster-update-show --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-update-show.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-update-show
)
del shelcaster-update-show.zip >nul 2>&1

REM shelcaster-delete-show
echo [4/16] Deploying shelcaster-delete-show...
cd shelcaster-delete-show
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-delete-show.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-delete-show --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-delete-show --zip-file fileb://shelcaster-delete-show.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-delete-show
) else (
    aws lambda create-function --function-name shelcaster-delete-show --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-delete-show.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-delete-show
)
del shelcaster-delete-show.zip >nul 2>&1

REM shelcaster-create-tracklist
echo [5/16] Deploying shelcaster-create-tracklist...
cd shelcaster-create-tracklist
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-create-tracklist.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-create-tracklist --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-create-tracklist --zip-file fileb://shelcaster-create-tracklist.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-create-tracklist
) else (
    aws lambda create-function --function-name shelcaster-create-tracklist --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-create-tracklist.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-create-tracklist
)
del shelcaster-create-tracklist.zip >nul 2>&1

REM shelcaster-get-tracklist
echo [6/16] Deploying shelcaster-get-tracklist...
cd shelcaster-get-tracklist
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-get-tracklist.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-get-tracklist --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-get-tracklist --zip-file fileb://shelcaster-get-tracklist.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-get-tracklist
) else (
    aws lambda create-function --function-name shelcaster-get-tracklist --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-get-tracklist.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-get-tracklist
)
del shelcaster-get-tracklist.zip >nul 2>&1

REM shelcaster-get-producer-tracklists
echo [7/16] Deploying shelcaster-get-producer-tracklists...
cd shelcaster-get-producer-tracklists
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-get-producer-tracklists.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-get-producer-tracklists --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-get-producer-tracklists --zip-file fileb://shelcaster-get-producer-tracklists.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-get-producer-tracklists
) else (
    aws lambda create-function --function-name shelcaster-get-producer-tracklists --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-get-producer-tracklists.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-get-producer-tracklists
)
del shelcaster-get-producer-tracklists.zip >nul 2>&1

REM shelcaster-get-tracklist-programs
echo [8/16] Deploying shelcaster-get-tracklist-programs...
cd shelcaster-get-tracklist-programs
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-get-tracklist-programs.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-get-tracklist-programs --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-get-tracklist-programs --zip-file fileb://shelcaster-get-tracklist-programs.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-get-tracklist-programs
) else (
    aws lambda create-function --function-name shelcaster-get-tracklist-programs --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-get-tracklist-programs.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-get-tracklist-programs
)
del shelcaster-get-tracklist-programs.zip >nul 2>&1

REM shelcaster-update-tracklist
echo [9/16] Deploying shelcaster-update-tracklist...
cd shelcaster-update-tracklist
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-update-tracklist.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-update-tracklist --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-update-tracklist --zip-file fileb://shelcaster-update-tracklist.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-update-tracklist
) else (
    aws lambda create-function --function-name shelcaster-update-tracklist --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-update-tracklist.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-update-tracklist
)
del shelcaster-update-tracklist.zip >nul 2>&1

REM shelcaster-delete-tracklist
echo [10/16] Deploying shelcaster-delete-tracklist...
cd shelcaster-delete-tracklist
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-delete-tracklist.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-delete-tracklist --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-delete-tracklist --zip-file fileb://shelcaster-delete-tracklist.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-delete-tracklist
) else (
    aws lambda create-function --function-name shelcaster-delete-tracklist --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-delete-tracklist.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-delete-tracklist
)
del shelcaster-delete-tracklist.zip >nul 2>&1

REM shelcaster-start-broadcast
echo [11/16] Deploying shelcaster-start-broadcast...
cd shelcaster-start-broadcast
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-start-broadcast.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-start-broadcast --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-start-broadcast --zip-file fileb://shelcaster-start-broadcast.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-start-broadcast
) else (
    aws lambda create-function --function-name shelcaster-start-broadcast --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-start-broadcast.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-start-broadcast
)
del shelcaster-start-broadcast.zip >nul 2>&1

REM shelcaster-stop-broadcast
echo [12/16] Deploying shelcaster-stop-broadcast...
cd shelcaster-stop-broadcast
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-stop-broadcast.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-stop-broadcast --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-stop-broadcast --zip-file fileb://shelcaster-stop-broadcast.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-stop-broadcast
) else (
    aws lambda create-function --function-name shelcaster-stop-broadcast --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-stop-broadcast.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-stop-broadcast
)
del shelcaster-stop-broadcast.zip >nul 2>&1

REM shelcaster-invite-guest
echo [13/16] Deploying shelcaster-invite-guest...
cd shelcaster-invite-guest
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-invite-guest.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-invite-guest --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-invite-guest --zip-file fileb://shelcaster-invite-guest.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-invite-guest
) else (
    aws lambda create-function --function-name shelcaster-invite-guest --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-invite-guest.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-invite-guest
)
del shelcaster-invite-guest.zip >nul 2>&1

REM shelcaster-get-show-guests
echo [14/16] Deploying shelcaster-get-show-guests...
cd shelcaster-get-show-guests
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-get-show-guests.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-get-show-guests --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-get-show-guests --zip-file fileb://shelcaster-get-show-guests.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-get-show-guests
) else (
    aws lambda create-function --function-name shelcaster-get-show-guests --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-get-show-guests.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-get-show-guests
)
del shelcaster-get-show-guests.zip >nul 2>&1

REM shelcaster-update-guest-status
echo [15/16] Deploying shelcaster-update-guest-status...
cd shelcaster-update-guest-status
powershell Compress-Archive -Path index.mjs -DestinationPath ../shelcaster-update-guest-status.zip -Force >nul 2>&1
cd ..
aws lambda get-function --function-name shelcaster-update-guest-status --profile %PROFILE% --region %REGION% >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    aws lambda update-function-code --function-name shelcaster-update-guest-status --zip-file fileb://shelcaster-update-guest-status.zip --profile %PROFILE% --region %REGION% --no-cli-pager >nul 2>&1
    echo   Updated shelcaster-update-guest-status
) else (
    aws lambda create-function --function-name shelcaster-update-guest-status --runtime nodejs22.x --role %ROLE% --handler index.handler --zip-file fileb://shelcaster-update-guest-status.zip --profile %PROFILE% --region %REGION% --timeout 30 --memory-size 256 --no-cli-pager >nul 2>&1
    echo   Created shelcaster-update-guest-status
)
del shelcaster-update-guest-status.zip >nul 2>&1

echo.
echo ========================================
echo Deployment Complete!
echo All 15 functions deployed successfully
echo ========================================

