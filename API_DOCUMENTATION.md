# LingoLinq API Documentation
## Authentication
### POST /oauth2/token (OAuth Token Exchange)
* Endpoint: POST /oauth2/token
* Purpose: Exchange an authorization code for an access token.
* Authentication:
   * Requires client_id and client_secret.
   * Does not require an existing access token.
* Required Parameters:
   * client_id: The client ID of the application requesting the token.
   * client_secret: The client secret of the application.
   * code: The authorization code obtained after user approval in the OAuth flow.
* Optional Parameters:
   * device_key: A unique identifier for the device making the request.
   * device_name: A name for the device.
* Request Example:
   ```json
   {
     "client_id": "YOUR_CLIENT_ID",
     "client_secret": "YOUR_CLIENT_SECRET",
     "code": "AUTHORIZATION_CODE"
   }
