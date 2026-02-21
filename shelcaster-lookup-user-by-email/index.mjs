import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'us-east-1' });
const USER_POOL_ID = process.env.USER_POOL_ID;

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('USER_POOL_ID:', USER_POOL_ID);
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Get email from query parameters
    const email = event.queryStringParameters?.email;
    
    if (!email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: 'Email parameter is required'
        })
      };
    }

    if (!USER_POOL_ID) {
      console.error('USER_POOL_ID environment variable is not set');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          message: 'Server configuration error: USER_POOL_ID not set'
        })
      };
    }

    console.log('Looking up user with email:', email);

    // Search for user by email in Cognito
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Filter: `email = "${email}"`,
      Limit: 1
    });

    const response = await cognitoClient.send(command);
    console.log('Cognito response:', JSON.stringify(response, null, 2));

    if (!response.Users || response.Users.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: `No user found with email: ${email}`
        })
      };
    }

    const user = response.Users[0];
    
    // Extract user attributes
    const attributes = {};
    user.Attributes?.forEach(attr => {
      attributes[attr.Name] = attr.Value;
    });

    // Return user info
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        userId: user.Username, // This is the Cognito sub
        sub: user.Username,
        email: attributes.email,
        emailVerified: attributes.email_verified === 'true',
        name: attributes.name,
        userStatus: user.UserStatus,
        enabled: user.Enabled,
        createdAt: user.UserCreateDate,
        updatedAt: user.UserLastModifiedDate
      })
    };

  } catch (error) {
    console.error('Error looking up user:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: 'Failed to lookup user',
        error: error.message
      })
    };
  }
};
