import pkg from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatVertexAI, VertexAI } from "@langchain/google-vertexai";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createRetrievalChain } from "langchain/chains/retrieval";
//import { GoogleAuth } from '@google-cloud/auth';

// const auth = await GoogleAuth.default();
// const credentials = await auth.getClientCredentials();
// Load environment variables from .env file
dotenv.config();
// Load the service account key file
const keyPath = 'key.json';
const key = fs.readFileSync(keyPath);
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;

const { Client, LocalAuth } = pkg;

// const model = new ChatVertexAI({
//   model: "gemini-1.5-flash",
//   temperature: 0,
// });

const model = new ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
  });

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Read the content of synthetic_data.txt
const syntheticData = fs.readFileSync("synthetic_data.txt", "utf-8");

// Split the synthetic data into manageable chunks
const docs = new Document({ content: syntheticData,metadata: {} });
//const splits = await textSplitter.splitDocuments(docs);

const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004", // 768 dimensions
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    title: "Document title",
    apiKey: process.env.API_KEY,
  });

const vectorstore = await MemoryVectorStore.fromDocuments(
  [docs],
  embeddings
);

const retriever = vectorstore.asRetriever();

// Error handling function (optional)
function handleError(err) {
  console.error("Error:", err);
  // Add more robust error handling here (e.g., retry logic, user notifications)
}

const systemTemplate = [
  `##Tentang
    Kamu adalah customer service sebuah program beasiswa dari Stargan Mitra Teknologi bernama program Stargan Bisnis Digital, Inovasi, dan Kewirausahaan dengan nama Rai. 

    ##Tugas
    Tugas kamu adalah menjawab pertanyaan terkait mata kuliah. Kamu hanya menjawab dalam maksimum 1 paragraf saja dengan bahasa Indonesia yang sopan dan ramah tanpa emoticon.

    ##Panggilan
    Selalu panggil dengan "Kak" atau "Kakak" atau "Juragan" atau "Agan" dan hindari memanggil dengan sebutan "Anda". 

    ##Batasan
    Jawab hanya yang kamu tahu saja. Arahkan mereka untuk kontak ke team@starganteknologi.com jika terdapat kendala. 

    ##Rekomendasi
    Kamu juga dapat memberikan rekomendasi mata kuliah dari data yang kamu punya jika mereka menanyakan rekomendasi yang diambil. 
    Tanyakan dulu mengenai kenginan profesi dia, dan atau jumlah maksimal mata kuliah yang bisa diambil. 
    Kemudian cocokkan dengan data yang kamu punya. Rekomendasikan setidaknya 5 mata kuliah.

    ##Call to Action
    Arahkan untuk segera mendaftar ke program Stargan Bisnis Digital, Inovasi, dan Kewirausahaan di starganteknologi.com dan hubungi team@starganteknologi.com jika terdapat kendala.
    `,
  `\n\n`,
  `{context}`,
].join("");

// Function to load synthetic data
function loadSyntheticData() {
  try {
    return fs.readFileSync("synthetic_data.txt", "utf-8");
  } catch (error) {
    handleError(error);
    return ""; // Handle empty data gracefully
  }
}

const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemTemplate],
  ["human", "{input}"],
]);

// Function to initialize the generative AI model
function initializeGenerativeAI() {
    
        return new GoogleGenerativeAI({
          credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Use environment variable for credentials
          model: "gemini-1.5-flash",
          temperature: 0, // Optionally adjust the temperature
        });
      
}

// Function to create a chat session
// Function to handle chat response
async function handleChat(model, inputMessage) {
    try {
      // 1. Combine user message with system template for context:
      const contextMessage = systemTemplate.replace("{context}", inputMessage);
  
      // 2. Use Langchain retrieval chain to find relevant data:
      const relevantData = await ragChain.invoke({ input: contextMessage });
  
      // 3. Generate response using the model:
      let responseText;
      if (relevantData) {
        // Use relevant data to inform the response generation
        responseText = await model.ChatPromptTemplate({
          prompt: inputMessage + "\n" + relevantData, // Combine user message and retrieved data
          maxOutputTokens: 200,
        });
      } else {
        // Fallback to model-only response if no relevant data found
        responseText = await model.ChatPromptTemplate({
          prompt: inputMessage,
          maxOutputTokens: 200,
        });
      }
      return responseText.text; // Return the model's text response
    } catch (error) {
      console.error("Error in chat handling:", error);
      return "Sorry, there was an issue processing your request.";
    }
  }

const questionAnswerChain = await createStuffDocumentsChain({
  llm: model,
  prompt,
});
const ragChain = await createRetrievalChain({
  retriever,
  combineDocsChain: questionAnswerChain,
});

// Function to embed synthetic data and store it in a vector store

// Function to find the most relevant response from synthetic data using embeddings
async function getRelevantData(query, vectorStore) {
  const results = await vectorStore.similaritySearch(query, 1);
  return results[0]?.pageContent || ""; // Return the most relevant content
}

async function main() {
  const syntheticData = loadSyntheticData();
  const model = initializeGenerativeAI();

  // Embed the synthetic data to create a vector store

  const client = new Client({
    authStrategy: new LocalAuth(), // Automatically saves the session in .wwebjs_auth/
    puppeteer: {
      executablePath: puppeteer.executablePath(), // Use Puppeteer installed in your project
      headless: true, // Run browser in headless mode
      args: ["--no-sandbox", "--disable-setuid-sandbox"], // For environments with limited sandboxing support
    },
  });

  // Listen for QR code generation and display it in the terminal
  client.on("qr", (qr) => {
    console.log("Scan this QR code with your WhatsApp to log in:");
    qrcode.generate(qr, { small: true });
  });

  // Log a message when authenticated
  client.on("authenticated", () => {
    console.log("WhatsApp client authenticated!");
  });

  // Handle client ready state
  client.on("ready", () => {
    console.log("WhatsApp client is ready to send and receive messages!");
  });

  // Handle incoming messages
  client.on("message", async (msg) => {
    console.log(`Received message from ${msg.from}: ${msg.body}`);

    const handleUserMessage = async (message) => {
      if (message === "!ping") {
        return "pong";
      } else if (message.startsWith("!echo ")) {
        return message.slice(6); // Extract the text after "!echo "
      } else if (message === "!mediainfo" && msg.hasMedia) {
        const attachmentData = await msg.downloadMedia();
        return `
          *Media Info*
          MimeType: ${attachmentData.mimetype}
          Filename: ${attachmentData.filename || "unknown"}
          Data Size: ${attachmentData.data.length} bytes
        `;
      } else {
        // const results = await ragChain.invoke({
        //     input: "What are you?",
        //   });
        // return results;
        // Get response from the model
         const response = await handleChat(model, message);
         //console.log(response);
         return response;
      }
    };

    const replyText = await handleUserMessage(msg.body);
    if (replyText) {
      await msg.reply(replyText);
    }
  });

  // Handle authentication failures
  client.on("auth_failure", handleError);

  // Handle client disconnection
  client.on("disconnected", (reason) => {
    console.log("WhatsApp client disconnected:", reason);
    process.exit(); // Exit the process to restart the client
  });

  async function sendMessageToChatbot(message) {
    const context = new Document({ content: message });
    const response = await chat.sendMessage(message, { context });
    return response.text;
  }

  // Initialize the WhatsApp client
  client.initialize();
}

main();
