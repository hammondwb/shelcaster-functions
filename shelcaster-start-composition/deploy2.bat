@echo off
cd /d %~dp0
aws lambda update-function-code --function-name shelcaster-start-composition --zip-file fileb://lambda-update.zip --region us-east-1 --profile shelcaster-admin

