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
```

## Boards API

### GET /utterances/r/:reply_code (Utterance Redirect)
* **Endpoint:** GET /utterances/r/:reply_code
* **Purpose:** Redirects to a shared utterance.
* **Required Parameters:**
  * reply_code: Unique code for the shared utterance.
* **Response:** Redirects to the utterance page.

### GET /goals/status/:goal_id (Log Goal Status)
* **Endpoint:** GET /goals/status/:goal_id
* **Purpose:** Logs the status of a user goal.
* **Required Parameters:**
  * goal_id: ID of the goal to update.
  * status: Status to set for the goal (can be in URL path).
* **Optional Parameters:**
  * goal_code: Additional code for the goal (can be in URL path).
* **Response:** Confirmation of goal status update.

### GET /utterances/:id (Utterance)
* **Endpoint:** GET /utterances/:id
* **Purpose:** Fetches an utterance based on its global ID.
* **Required Parameters:**
  * id: Global ID of the utterance.
* **Response:** Utterance data.

## API Framework Information

The application uses several controller methods to manage API requests:

* **check_api_token:** Authenticates API requests via tokens.
* **log_api_call:** Logs all API calls.
* **api_error:** Returns standardized JSON error responses.
* **exists?:** Checks for record existence.
* **allowed?:** Checks permissions.
* **set_browser_token_header:** Sets a header with a browser token.

## Button API

### GET /api/v1/buttons (Get Buttons)
* **Endpoint:** GET /api/v1/buttons
* **Purpose:** Retrieves a list of buttons for a given user.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * user_id: The user ID to fetch buttons for.
* **Optional Parameters:**
  * page: The page number for pagination.
  * per_page: The number of buttons per page.
  * deleted: If set to 'true' only deleted buttons are returned.
  * type: Filter results by type.
  * updated_since: Returns only buttons updated since this time.
* **Response:** List of button objects.

### POST /api/v1/buttons (Create Button)
* **Endpoint:** POST /api/v1/buttons
* **Purpose:** Creates a new button for a given user.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * user_id: The global ID of the user creating the button.
  * type: The type of button.
  * data: The data for the button.
* **Response:** The newly created button.

### GET /api/v1/buttons/:id (Get Button)
* **Endpoint:** GET /api/v1/buttons/:id
* **Purpose:** Returns a specific button.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * id: The ID of the button to show.
* **Response:** The requested button.

### PATCH /api/v1/buttons/:id (Update Button)
* **Endpoint:** PATCH /api/v1/buttons/:id
* **Purpose:** Updates a specific button.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * id: The ID of the button to update.
  * data: The updated data.
* **Response:** The updated button.

### DELETE /api/v1/buttons/:id (Delete Button)
* **Endpoint:** DELETE /api/v1/buttons/:id
* **Purpose:** Deletes a specific button.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * id: The ID of the button to destroy.
* **Response:** The deleted button.

## Device API

### GET /api/v1/devices (Get Devices)
* **Endpoint:** GET /api/v1/devices
* **Purpose:** Retrieves a list of devices for the authenticated user.
* **Authentication:** Requires a valid API token.
* **Optional Parameters:**
  * include_user: Include user information in the returned devices.
* **Response:** List of device objects.

### GET /api/v1/devices/:id (Get Device)
* **Endpoint:** GET /api/v1/devices/:id
* **Purpose:** Returns a specific device.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * id: The ID of the device to return.
* **Optional Parameters:**
  * include_user: Include user information in the returned device.
* **Response:** The requested device.

### PATCH /api/v1/devices/:id (Update Device)
* **Endpoint:** PATCH /api/v1/devices/:id
* **Purpose:** Updates a specific device.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * id: The ID of the device to update.
  * name: The updated name of the device.
* **Response:** The updated device.

### DELETE /api/v1/devices/:id (Delete Device)
* **Endpoint:** DELETE /api/v1/devices/:id
* **Purpose:** Deletes a specific device.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * id: The ID of the device to delete.
* **Response:** The deleted device.

### POST /api/v1/devices (Create Device)
* **Endpoint:** POST /api/v1/devices
* **Purpose:** Creates a new device for a given user.
* **Authentication:** Requires a valid API token.
* **Required Parameters:**
  * user_id: The global ID of the user that owns this device.
  * name: The name of the device.
* **Response:** The newly created device.

API paths generally follow these patterns:
* OAuth endpoints: `/oauth2/...`
* SAML authentication: `/saml/...`
* API version 1: `/api/v1/...`
* Authentication: `/auth/...`

Add Button and Device API endpoints
