# Deploy Phase 2: Session Integration with Persistent Channels
# This script deploys both modified Lambda functions for Phase 2

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2 Deployment: Session Integration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Deploy create-session Lambda
Write-Host "Step 1/2: Deploying shelcaster-create-session..." -ForegroundColor Yellow
.\deploy-create-session-phase2.ps1

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Deploy end-session Lambda
Write-Host "Step 2/2: Deploying shelcaster-end-session..." -ForegroundColor Yellow
.\deploy-end-session-phase2.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2 Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Review PHASE2-TESTING-GUIDE.md for testing procedures" -ForegroundColor White
Write-Host "2. Ensure you have a test channel assigned to a host (from Phase 1)" -ForegroundColor White
Write-Host "3. Run Test 1: Create session with assigned channel" -ForegroundColor White
Write-Host "4. Run Test 2: End session and verify channel preservation" -ForegroundColor White
Write-Host "5. Run Test 3: Create second session to verify channel reuse" -ForegroundColor White
Write-Host ""
Write-Host "Key Changes:" -ForegroundColor Cyan
Write-Host "  - Sessions now use persistent channels with static playback URLs" -ForegroundColor Green
Write-Host "  - Channels are preserved after broadcast ends" -ForegroundColor Green
Write-Host "  - Relay channels are temporary and deleted after session" -ForegroundColor Green
Write-Host "  - Channel statistics are tracked" -ForegroundColor Green
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Cyan
Write-Host "  - PHASE2-TESTING-GUIDE.md - Comprehensive testing procedures" -ForegroundColor White
Write-Host "  - PERSISTENT-CHANNELS-PHASE2-COMPLETE.md - Phase 2 summary" -ForegroundColor White
Write-Host ""
