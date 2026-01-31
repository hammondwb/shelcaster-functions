module.exports = {
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  tableName: process.env.TABLE_NAME || 'shelcaster-app',
  mediaBucket: process.env.MEDIA_BUCKET || 'shelcaster-media-manager',
  cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN || 'd2kyyx47f0bavc.cloudfront.net',
  testRunId: process.env.TEST_RUN_ID || `test-${Date.now()}`
};
