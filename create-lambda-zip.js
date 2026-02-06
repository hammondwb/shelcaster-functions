const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const sourceDir = 'shelcaster-create-session';
const outputFile = 'lambda-package.zip';

// Remove old zip if exists
if (fs.existsSync(outputFile)) {
  fs.unlinkSync(outputFile);
  console.log(`Removed old zip file: ${outputFile}`);
}

// Create zip file
console.log(`Creating zip file from ${sourceDir}...`);

const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

output.on('close', function() {
  console.log(`Zip file created: ${outputFile}`);
  console.log(`Size: ${(archive.pointer() / (1024*1024)).toFixed(2)} MB`);
  
  // Deploy to Lambda
  console.log('\nDeploying to Lambda function: shelcaster-create-session...');
  try {
    execSync(
      `aws lambda update-function-code --function-name shelcaster-create-session --zip-file fileb://${outputFile} --region us-east-1 --profile shelcaster-admin --no-cli-pager`,
      { stdio: 'inherit' }
    );
    console.log('✓ Deployment successful!');
    
    // Cleanup
    fs.unlinkSync(outputFile);
    console.log(`\nCleaned up: ${outputFile}`);
  } catch (error) {
    console.error('✗ Deployment failed!');
    console.error(error.message);
    process.exit(1);
  }
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);

// Add all files from source directory
archive.directory(sourceDir, false);

archive.finalize();

