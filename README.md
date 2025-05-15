# Twilio SKO 2025 Hackathon: Conversation Relay & Flex

This repository contains prototype packages for Twilio Conversation Relay (CR) and a Flex Plugin that offers agent assistance to a customer engaging in the CR self-service flow.

These examples are built upon Twilio's Serverless Functions and generally require utilization of the Twilio CLI and serverless runtime plugin.  Reference the section on "Prerequisites" for more details.

&nbsp;

## Architecture

This is the typical architecture that reflects the communications between the Flex UI (plugin) and the Twilio Cloud (Serverless Functions).

There are three (3) primary parts of this demonstration package.  They are:
- Conversation Relay Websocket server ( apps >> convRelayApp ) node process;
- Twilio Function for agent handoff ( Twilio CLI serverless process); and
- Flex Plugin ( apps >> flexPluginApp ) (Twilio CLI Flex plugin process).

>NOTE: In a development/testing environment there are three (3) processes running to support a demonstration in DEV.  These are: (1) The CR websocket server (node application) runs locally on port 3000; (2) A separate process is used to host the Twilio Function responsible for agentHandoff.  This uses the Twilio CLI and runs on port 3001; and (3) A final process is used to start the Flex UI with the plugin.  This also uses the Twilio CLI and Flex plugin running on port 3002.

&nbsp;

![Typical Twilio Architecture](/images/convRelayFlexArch.jpg)  
&nbsp;

## Prerequisites

- Twilio CLI (command line interface) : [CLI Quickstart Guide](https://www.twilio.com/docs/twilio-cli/quickstart)
- Twilio Serverless & Flex Plugin : [CLI Plugins](https://www.twilio.com/docs/twilio-cli/plugins)
- A New Flex Account
- Code editor of choice ( e.g. Visual Studio Code)


## Configure/Test/Deploy

Perform the following steps to configure, test and deploy this Twilio Flex plugin and supporting Twilio Functions.  
&nbsp;

### Step 1 : Create a new Flex Account

Use the Twilio Console to create a new Flex Account

&nbsp;

### Step 2 : Install Twilio CLI (command line interface)


1. Install CLI using the official [Twilio CLI Quickstart](https://www.twilio.com/docs/twilio-cli/quickstart)
```
brew install twilio
```
2. Install the CLI plugins for serverless and Flex [CLI Plugins](https://www.twilio.com/docs/twilio-cli/plugins)
```
twilio plugins:install @twilio-labs/plugin-serverless
```
```
twilio plugins:install @twilio-labs/plugin-flex
```
3. Create a [CLI profile](https://www.twilio.com/docs/twilio-cli/general-usage))

```
twilio profiles:create
```

4. Set CLI active profile

```
twilio profiles:use <ProfileName>
```

&nbsp;

### Step 3 : Install/Config of the Conversation Relay App ( socket server )

Follow the instructions in the [README](/apps/convRelayApp/README.md) file for the CR App.

### Step 4: Install/Config of the Flex Plugin

Follow the instructions in the [README](/apps/flexPluginApp/README.md) file for the Flex Plugin App.

### Step 5: Import the example Studio Flow

There is a example [Studio Flow](/docs/studio.json) that can be used to redirect the incoming call to the Conversation Relay socket server.  Use this JSON file to import the example flow into your project.

The screenshot below illustrate this flow. Set the URI location of your websocket server.

![IncomingCallStudioFlow](/images/IncomingCallStudioFlow.jpg) 

>NOTE: Specify the URI location of your websocket server in the Studio Variable Widget.

&nbsp;

## Conversation Relay: Add tool for agent handoff 

In index.js, find the array that defines the AI Assistant's tools at line 21.  Add the following code block within the array to add a function for transfering the call. 
```
 {
    type: 'function',
    function: {
      name: 'agent_handoff',
      say: 'One moment while I transfer your call.',
      description: 'Transfers the customer to a live agent in case they request help from a real person.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Whether or not the customer call was successfully transfered'
          },
        }
      }
    },
 }
 ```
 Add the agent_handoff tool within toolFunctions in line 75. The final object should look like this: 
 ```
 const toolFunctions = {
  get_programming_joke: async () => getJoke(),
  agent_handoff: async () => handleLiveAgentHandoff()
};
 ```

Now add the async function for handling the live agent handoff
 ```
async function handleLiveAgentHandoff (callSid) {
  await client.calls(callSid).update(
    {  twiml: 
    `<Response><Say>One second while we connect you</Say><Redirect>` +
    process.env.STUDIO_FLOW_URL
    + `</Redirect></Response>`
    }
  );
}
 ```

 We added an environment variable that we'll need to add to our .env file.


### Step 6: Launch Conversation Relay Socket Server

Use the following command to launch the CR websocket server in a local development (DEV) mode from within the root folder 'apps >> convRelayApp' :

``` 
npm run dev
```
> NOTE: This command should launch the ConvRelayApp node application on port 3000.

&nbsp;

### Step 7. Launch Twilio Functions (agenthandoff)

Use the following command to launch the Twilio server functions locally.

>NOTE: Specify that this should run on port 3001.

```
cd serverless-cr
twilio serverless start
```
&nbsp;

### Step 8. Launch the Twilio Flex Plugin

Use the following command to launch the Twilio Flex plugin locally from within the folder 'apps/flexPluginApp':

> NOTE: Specify that this should run on port 3002.

```
cd flexPluginApp
twilio flex:plugins:start
```

>NOTE: Choose port 3002 to run this Flex Plugin on.

&nbsp;
