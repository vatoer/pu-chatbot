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
import { ChatVertexAI } from "@langchain/google-vertexai";
import { Document } from "langchain/document";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { createRetrievalChain } from "langchain/chains/retrieval";

const { Client, LocalAuth } = pkg;

// Load environment variables
dotenv.config();

// Check if API_KEY is available
if (!process.env.API_KEY) {
  console.error("Error: API_KEY is not set in the environment variables.");
  process.exit(1); // Exit if the API key is missing
}

// Initialize the Google Generative AI instance
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function handleError(err) {
  console.error("Error:", err);
  // Add more robust error handling here (e.g., retry logic, user notifications)
}

const systemTemplate = [
  `##Tentang
      Kamu adalah customer service sebuah program beasiswa dari Stargan Mitra Teknologi bernama program Stargan Bisnis Digital, Inovasi, dan Kewirausahaan dengan nama Rai. 
  
      ##Tugas
      Tugas kamu adalah menjawab pertanyaan terkait mata kuliah. Kamu hanya menjawab dalam 1 paragraf saja dengan bahasa Indonesia yang sopan dan ramah tanpa emoticon.
  
      ##Panggilan
      Selalu panggil dengan "Kak"/ "Kakak" / "Digiers" dan hindari memanggil dengan sebutan "Anda". 
  
      ##Batasan
      Jawab hanya yang kamu tahu saja. Arahkan mereka untuk kontak ke team@starganteknologi.com jika terdapat kendala. 
  
      ##Rekomendasi
      Kamu juga dapat memberikan rekomendasi mata kuliah dari data yang kamu punya jika mereka menanyakan rekomendasi yang diambil. Tanyakan dulu mengenai kenginan profesi dia, dan jumlah maksimal mata kuliah yang bisa diambil. Kemudian cocokkan dengan data yang kamu punya. Rekomendasikan setidaknya 5 mata kuliah.
      `,
  `\n\n`,
  `{context}`,
].join("");

function loadSyntheticData() {
  try {
    return fs.readFileSync("synthetic_data.txt", "utf-8");
  } catch (error) {
    handleError(error);
    return ""; // Handle empty data gracefully
  }
}

// Read the content of synthetic_data.txt
const syntheticData = loadSyntheticData();

// Split the synthetic data into manageable chunks
const docs = new Document({ content: syntheticData, metadata: {} });
//const splits = await textSplitter.splitDocuments(docs);

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
  apiKey: process.env.API_KEY,
});

const vectorstore = await MemoryVectorStore.fromDocuments([docs], embeddings);

const retriever = vectorstore.asRetriever();

const prompt = ChatPromptTemplate.fromMessages([
  ["system", systemTemplate],
  ["human", "{input}"],
]);

// Get the generative model (e.g., "gemini-pro")
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Wrap the GoogleGenerativeAI model in a LangChain Runnable
const wrappedModel = {
  invoke: async (input) => {
    const mymodel = model;
    const chat = model.startChat({
      prompt: input,
      maxTokens: 200,
    });

    // Send the prompt to the chatbot
    const result = await chat.sendMessage(input);
    // Extract the response text
    const response = result.response;
    const text = response.text(); // Ensure the text is awaited properly

    return text; // Return the generated text
  },
};

const questionAnswerChain = await createStuffDocumentsChain({
  llm: wrappedModel,
  prompt,
});
const ragChain = await createRetrievalChain({
  retriever,
  combineDocsChain: questionAnswerChain,
});

async function handleChat(prompt) {
  try {
    //1. Combine user message with system template for context:
    //const contextMessage = systemTemplate.replace("{context}", prompt);

    const contextMessage = "What are you?";

    // 2. Use Langchain retrieval chain to find relevant data:
    try {
      //const relevantData = await ragChain.invoke({ input: contextMessage });
      //console.log("Relevant data:", relevantData);
      console.log("contextMessage data:", contextMessage);
    } catch (error) {
      console.log("contextMessage data:", contextMessage);
      console.error("Error generating content:", error);
    }
    // Generate content based on the prompt
    const chat = model.startChat({
      prompt: prompt,
      maxTokens: 200,
    });

    // Send the prompt to the chatbot
    const result = await chat.sendMessage(prompt);

    // Extract the response text
    const response = result.response;
    const text = response.text(); // Ensure the text is awaited properly

    return text; // Return the generated text
  } catch (error) {
    console.error("Error generating content:", error);
    return "Sorry, there was an error generating the content. Please try again later.";
  }
}

async function run() {

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
        const response = await handleChat(message);
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

  //   async function sendMessageToChatbot(message) {
  //     const context = new Document({ content: message });
  //     const response = await chat.sendMessage(message, { context });
  //     return response.text;
  //   }

  // Initialize the WhatsApp client
  client.initialize();
}

run();
