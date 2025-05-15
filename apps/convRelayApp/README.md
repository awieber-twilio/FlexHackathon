# Voice Assistant with Twilio and Open AI (Node.js)

This application demonstrates how to use Node.js, [Twilio Voice](https://www.twilio.com/docs/voice) and [ConversationRelay](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay), and the [Open AI API](https://docs.anthropic.com) to create a voice assistant that can engage in two-way conversations over a phone call. Other branches in this repository demonstrate how to add more advanced features such as streaming, interruption handling, and tool/function calling.


## Setup

### 1. Run ngrok

You'll need to expose your local server to the internet for Twilio to access it. Use ngrok for tunneling:

```bash
ngrok http 8080
```

Copy the Forwarding URL and put it aside; it looks like https://[your-ngrok-subdomain].ngrok.app. You'll need it in a couple places.

### 2. Install dependencies

Navigate to the current directory:
```
cd apps/convRelayApp
```
Run the following command to install necessary packages:

```bash
npm install
```

### 3. Configure Twilio

Update Your Twilio Phone Number: In the Twilio Console under **Phone Numbers**, set the Webhook for **A call comes in** to your ngrok URL followed by /twiml. 

Example: `https://[your-ngrok-subdomain].ngrok.app/twiml`.
```

### 4. Configure Environment Variables

Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

Edit the .env file and input your Open AI API key in `OPENAI_API_KEY`. Add your ngrok URL in `NGROK_URL` (do not include the scheme, "http://" or "https://")

## Run the app

Start the development server:

```bash
node index.js
```

## Test the app

Call your Twilio phone number. After connection, you should be able to converse with the Open AI-powered AI Assistant, integrated over ConversationRelay with Twilio Voice!

Ask your agent anything! Who won the Oscar for Best Picture in 2002? Is a hot dog a sandwich or a taco? Can you tell me a programming joke? 

After you're done chatting with your bot, follow the next step to hand off your conversation from a bot to a human agent.

## Conversation Relay: Add tool for agent handoff 

In index.js, find the array that defines the AI Assistant's tools at line 26.  Add the following code block within the array to add a function for transfering the call. 
```
 {
    type: 'function',
    function: {
      name: 'agent_handoff',
      say: 'One moment while I transfer your call.',
      description: 'Transfers the customer to a live agent in case they request help from a real person.',
      parameters: {
        type: 'object',
        properties: {
          callSid: {
            type: 'string',
            description: 'The unique identifier for the active phone call.',
          },
        },
        required: ['callSid'],
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
 Add the agent_handoff tool within toolFunctions in line 81. The final object should look like this: 
 ```
 const toolFunctions = {
  get_programming_joke: async () => getJoke(),
  agent_handoff: async (callSid) => handleLiveAgentHandoff(callSid)
};
 ```

Now add the async function for handling the live agent handoff
 ```
async function handleLiveAgentHandoff(callSid) {
  await client.calls(callSid).update(
    {  twiml: 
    `<Response><Say>One second while we connect you</Say><Redirect>` +
    process.env.STUDIO_FLOW_URL
    + `?FlowEvent=return</Redirect></Response>`
    }
  );
}
 ```

 We added an environment variable that we'll need to add to our .env file.

 ### Step 4: Import Studio Flow
 Follow step 4 linked [here](/README) to import your Studio Flow and update your .env file.

> [!NOTE] 
> Customize the initial greeting and response behavior by modifying the aiResponse function and constants like SYSTEM_PROMPT in index.js.
> Ensure that you update ngrok URLs each time you restart ngrok, as they change with each session.
