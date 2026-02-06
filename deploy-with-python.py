#!/usr/bin/env python3
import zipfile
import os
import subprocess
import sys

def create_zip(source_dir, output_file):
    """Create a zip file from a directory"""
    print(f"Creating zip file from {source_dir}...")
    
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                print(f"  Adding: {arcname}")
                zipf.write(file_path, arcname)
    
    print(f"Zip file created: {output_file}")
    print(f"Size: {os.path.getsize(output_file) / (1024*1024):.2f} MB")

def deploy_lambda(zip_file, function_name):
    """Deploy the zip file to Lambda"""
    print(f"\nDeploying to Lambda function: {function_name}...")
    
    cmd = [
        'aws', 'lambda', 'update-function-code',
        '--function-name', function_name,
        '--zip-file', f'fileb://{zip_file}',
        '--region', 'us-east-1',
        '--profile', 'shelcaster-admin',
        '--no-cli-pager'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✓ Deployment successful!")
        return True
    else:
        print(f"✗ Deployment failed!")
        print(f"Error: {result.stderr}")
        return False

def main():
    source_dir = 'shelcaster-create-session'
    zip_file = 'lambda-package.zip'
    function_name = 'shelcaster-create-session'
    
    # Remove old zip if exists
    if os.path.exists(zip_file):
        os.remove(zip_file)
        print(f"Removed old zip file: {zip_file}")
    
    # Create zip
    create_zip(source_dir, zip_file)
    
    # Deploy
    success = deploy_lambda(zip_file, function_name)
    
    # Cleanup
    if os.path.exists(zip_file):
        os.remove(zip_file)
        print(f"\nCleaned up: {zip_file}")
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()

