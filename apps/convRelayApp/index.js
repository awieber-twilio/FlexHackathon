import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import fastifyFormbody from "@fastify/formbody";
import dotenv from "dotenv";
import twilio from "twilio";
dotenv.config();

const { ACCOUNT_SID, AUTH_TOKEN } = process.env;
const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

const PORT = process.env.PORT || 8080;
const DOMAIN = process.env.NGROK_URL;
const WS_URL = `wss://${DOMAIN}/ws`;
const WELCOME_GREETING =
  "Hi! I am a voice assistant powered by Twilio and Open A I . Ask me anything!";
const SYSTEM_PROMPT = `You are a helpful assistant. This conversation is being translated to voice, so answer carefully.
  When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.
  You should use the 'get_programming_joke' function only when the user is asking for a programming joke (or a very close prompt, such as developer or software engineering joke). For other requests, including other types of jokes, you should use your own knowledge.
  You should use the 'agent_handoff' function only when the user asks to be transferred to an agent (or a very close prompt, such as human agent or representative)`;
const sessions = new Map();

import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

import axios from "axios";
const tools = [
  {
    type: "function",
    function: {
      name: "get_programming_joke",
      description: "Fetches a programming joke",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
  },
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
];

async function getJoke() {
  // Use jokeapi.dev to fetch a clean joke
  const response = await axios.get(
    "https://v2.jokeapi.dev/joke/Programming?safe-mode"
  );
  const data = response.data;
  return data.type === "single"
    ? data.joke
    : `${data.setup} ... ${data.delivery}`;
}

async function handleLiveAgentHandoff(callSid) {
  console.log("call SID ", callSid);
  await client.calls(callSid).update(
    {  twiml: 
    `<Response><Say>One second while we connect you</Say><Redirect>` +
    process.env.STUDIO_FLOW_URL
    + `?FlowEvent=return</Redirect></Response>`
    }
  );
}



const toolFunctions = {
  get_programming_joke: async () => getJoke(),
  agent_handoff: async (callSid) => handleLiveAgentHandoff(callSid)
};

async function aiResponseStream(messages, ws) {
  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    stream: true,
    tools: tools,
  });

  const assistantSegments = [];
  console.log("Received response chunks:");
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    const toolCalls = chunk.choices[0].delta.tool_calls || [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolFn = toolFunctions[toolName];

      if (toolFn) {
        console.log("call sid ", ws.callSid);
        const toolResponse = await toolFn(ws.callSid);
        console.log("Using tool ", toolCall.id);
        

        // Append tool call request and the result with the "tool" role
        messages.push({
          role: "assistant",
          tool_calls: [
            {
              id: toolCall.id,
              function: {
                name: toolName,
                arguments: ws.callSid,
              },
              type: "function",
            },
          ],
        });

        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResponse,
        });

        // Send the completed tool response to the client
        ws.send(
          JSON.stringify({ type: "text", token: toolResponse, last: true })
        );
        assistantSegments.push(toolResponse);
        console.log(`Fetched ${toolName}:`, toolResponse);
      }
    }

    // Send each token
    console.log(content);
    ws.send(
      JSON.stringify({
        type: "text",
        token: content,
        last: false,
      })
    );
    assistantSegments.push(content);
  }

  const finalResponse = assistantSegments.join("");
  console.log("Assistant response complete:", finalResponse);
  messages.push({
    role: "assistant",
    content: finalResponse,
  });
}

function handleInterrupt(callSid, utteranceUntilInterrupt) {
  const conversation = sessions.get(callSid);

  let updatedConversation = [...conversation];

  const interruptedIndex = updatedConversation.findIndex(
    (message) =>
      message.role === "assistant" &&
      message.content.includes(utteranceUntilInterrupt)
  );

  if (interruptedIndex !== -1) {
    const interruptedMessage = updatedConversation[interruptedIndex];

    const interruptPosition = interruptedMessage.content.indexOf(
      utteranceUntilInterrupt
    );
    const truncatedContent = interruptedMessage.content.substring(
      0,
      interruptPosition + utteranceUntilInterrupt.length
    );

    updatedConversation[interruptedIndex] = {
      ...interruptedMessage,
      content: truncatedContent,
    };

    updatedConversation = updatedConversation.filter(
      (message, index) =>
        !(index > interruptedIndex && message.role === "assistant")
    );
  }

  sessions.set(callSid, updatedConversation);
}

const fastify = Fastify({ logger: true });
fastify.register(fastifyWs);
fastify.register(fastifyFormbody);
fastify.all("/twiml", async (request, reply) => {
  reply.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <ConversationRelay url="${WS_URL}" welcomeGreeting="${WELCOME_GREETING}" />
      </Connect>
    </Response>`
  );
});

fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (ws, req) => {
    ws.on("message", async (data) => {
      const message = JSON.parse(data);
     
      switch (message.type) {
        case "setup":
          const callSid = message.callSid;
          console.log("Setup for call:", callSid);
          ws.callSid = callSid;
          sessions.set(callSid, [{ role: "system", content: SYSTEM_PROMPT }]);
          break;
        case "prompt":
          console.log("Processing prompt:", message.voicePrompt);
          const messages = sessions.get(ws.callSid);

          messages.push({ role: "user", content: message.voicePrompt });

          await aiResponseStream(messages, ws);

          // Send the final "last" token when streaming completes
          ws.send(
            JSON.stringify({
              type: "text",
              token: "",
              last: true,
            })
          );
          break;
        case "interrupt":
          console.log(
            "Handling interruption; last utterance: ",
            message.utteranceUntilInterrupt
          );
          handleInterrupt(ws.callSid, message.utteranceUntilInterrupt);
          break;
        default:
          console.warn("Unknown message type received:", message.type);
          break;
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
      sessions.delete(ws.callSid);
    });
  });
});

try {
  fastify.listen({ port: PORT });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
