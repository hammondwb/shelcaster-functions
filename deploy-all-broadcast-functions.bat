@echo off
echo ========================================
echo Deploying Broadcast Studio Lambda Functions
echo ========================================
echo.

call deploy-one-function.bat shelcaster-create-show
call deploy-one-function.bat shelcaster-get-show
call deploy-one-function.bat shelcaster-get-producer-shows
call deploy-one-function.bat shelcaster-update-show
call deploy-one-function.bat shelcaster-delete-show
call deploy-one-function.bat shelcaster-create-tracklist
call deploy-one-function.bat shelcaster-get-tracklist
call deploy-one-function.bat shelcaster-get-producer-tracklists
call deploy-one-function.bat shelcaster-get-tracklist-programs
call deploy-one-function.bat shelcaster-update-tracklist
call deploy-one-function.bat shelcaster-delete-tracklist
call deploy-one-function.bat shelcaster-start-broadcast
call deploy-one-function.bat shelcaster-stop-broadcast
call deploy-one-function.bat shelcaster-invite-guest
call deploy-one-function.bat shelcaster-get-show-guests
call deploy-one-function.bat shelcaster-update-guest-status

echo.
echo ========================================
echo Deployment Complete!
echo ========================================

