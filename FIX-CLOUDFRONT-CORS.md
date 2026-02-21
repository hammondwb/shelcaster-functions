# Fix CloudFront CORS for HLS Playback

## Problem
The CloudFront distribution for `shelcaster-media-manager` bucket doesn't have CORS headers, blocking HLS video playback from localhost and other origins.

## Solution: Add Response Headers Policy to CloudFront

### Step 1: Find the CloudFront Distribution ID

```powershell
aws cloudfront list-distributions --profile shelcaster-admin --query "DistributionList.Items[?Origins.Items[?DomainName=='shelcaster-media-manager.s3.us-east-1.amazonaws.com']].{Id:Id,DomainName:DomainName,Status:Status}" --output table
```

Or find the distribution that serves `d2kyyx47f0bavc.cloudfront.net`:

```powershell
aws cloudfront list-distributions --profile shelcaster-admin --query "DistributionList.Items[?contains(Aliases.Items, 'd2kyyx47f0bavc.cloudfront.net') || DomainName=='d2kyyx47f0bavc.cloudfront.net'].{Id:Id,DomainName:DomainName,Origins:Origins.Items[0].DomainName}" --output table
```

### Step 2: Create Response Headers Policy

Create a file `cors-policy.json`:

```json
{
  "Name": "shelcaster-media-cors-policy",
  "Comment": "CORS policy for HLS video playback",
  "CorsConfig": {
    "AccessControlAllowOrigins": {
      "Quantity": 3,
      "Items": [
        "http://localhost:8080",
        "http://localhost:5173",
        "https://your-production-domain.com"
      ]
    },
    "AccessControlAllowHeaders": {
      "Quantity": 4,
      "Items": [
        "Content-Type",
        "Authorization",
        "Range",
        "*"
      ]
    },
    "AccessControlAllowMethods": {
      "Quantity": 3,
      "Items": [
        "GET",
        "HEAD",
        "OPTIONS"
      ]
    },
    "AccessControlAllowCredentials": false,
    "AccessControlExposeHeaders": {
      "Quantity": 2,
      "Items": [
        "Content-Length",
        "Content-Range"
      ]
    },
    "AccessControlMaxAgeSec": 3600,
    "OriginOverride": true
  }
}
```

Create the policy:

```powershell
aws cloudfront create-response-headers-policy --response-headers-policy-config file://cors-policy.json --profile shelcaster-admin
```

Note the `Id` from the response (e.g., `abc123def456`).

### Step 3: Get Current CloudFront Distribution Config

Replace `DISTRIBUTION_ID` with the ID from Step 1:

```powershell
aws cloudfront get-distribution-config --id DISTRIBUTION_ID --profile shelcaster-admin > distribution-config.json
```

### Step 4: Update Distribution to Use the Policy

Edit `distribution-config.json`:
1. Find the `"DefaultCacheBehavior"` section
2. Add or update the `"ResponseHeadersPolicyId"` field with the policy ID from Step 2

Example:
```json
"DefaultCacheBehavior": {
  "ResponseHeadersPolicyId": "abc123def456",
  ...
}
```

### Step 5: Apply the Updated Configuration

Extract the ETag from the original response and apply:

```powershell
aws cloudfront update-distribution --id DISTRIBUTION_ID --distribution-config file://distribution-config.json --if-match ETAG_VALUE --profile shelcaster-admin
```

## Alternative: Quick Fix via AWS Console

1. Go to CloudFront in AWS Console
2. Find the distribution with domain `d2kyyx47f0bavc.cloudfront.net`
3. Go to "Behaviors" tab
4. Edit the default behavior
5. Under "Response headers policy", create a new policy or select an existing CORS policy
6. Add these CORS settings:
   - Access-Control-Allow-Origin: `*` (or specific origins)
   - Access-Control-Allow-Methods: `GET, HEAD, OPTIONS`
   - Access-Control-Allow-Headers: `*`
   - Access-Control-Expose-Headers: `Content-Length, Content-Range`
7. Save and wait for deployment (5-10 minutes)

## Option 2: S3 Bucket CORS (May not work with CloudFront)

If the above doesn't work, also configure CORS on the S3 bucket:

```powershell
aws s3api put-bucket-cors --bucket shelcaster-media-manager --cors-configuration file://s3-cors.json --profile shelcaster-admin
```

Where `s3-cors.json` contains:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["Content-Length", "Content-Range"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## Verification

After applying changes, test with:

```bash
curl -I -H "Origin: http://localhost:8080" https://d2kyyx47f0bavc.cloudfront.net/recordings/test.m3u8
```

Look for `Access-Control-Allow-Origin` header in the response.

## Notes

- CloudFront changes take 5-15 minutes to propagate
- For production, replace `*` with specific allowed origins
- The `Range` header is important for HLS video streaming
