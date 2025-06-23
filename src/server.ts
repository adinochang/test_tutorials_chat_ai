// https://www.youtube.com/watch?v=VR3p7almo_c
import express, { Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { StreamChat } from 'stream-chat'
import OpenAI from 'openai'
import { log } from 'console'
import { db } from './config/database.js'
import { chats, users } from './db/schema.js'
import { eq } from 'drizzle-orm'
import { ChatCompletionMessageParam } from 'openai/resources.mjs'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended: false}))

// Init Stream Chat client
const chatClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

// Init Open AI client
const openAI = new OpenAI({
  apiKey: process.env.OPEN_AI_API_KEY
});


// Register user with Stream Chat 
app.post('/register-user', async (req: Request, res: Response):Promise<any> => {
    const { name, email } = req.body; 

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required'})
    }

    try {
        const userId = email.replace(/[^a-zA-Z0-9_-]/g, '_')

        // Check if user exists
        const userResponse = await chatClient.queryUsers({ id: { $eq: userId } }) // returns an array called users

        if (!userResponse.users.length) {
            // Add a new user to Stream Chat. If doing this from frontend app, create a token instead
            await chatClient.upsertUser({ 
                id: userId, 
                name: name, 
                // email: email, 
                role: 'user'
            })
        }

        // Check for existing user in DB 
        const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.userId, userId))

        if (!existingUser.length) {
            console.log(`User ${userId} not found. Creating user`)
            await db.insert(users).values({
                userId, name, email
            })
        }
            
        res.status(200).json({ userId, name, email });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }    
})

// Send message to OpenAI 
app.post('/chat', async (req: Request, res: Response): Promise<any> => {
    const { message, userId } = req.body

    if (!message || !userId) {
      return res.status(400).json({ error: 'Message and user are required' });
    }

    try {
      // Verify user exists
      const userResponse = await chatClient.queryUsers({ id: userId });

      if (!userResponse.users.length) {
        return res
          .status(404)
          .json({ error: "User not found. Please register first" });
      }

      // Check for existing user in DB
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId));

      if (!existingUser.length) {
        return res
          .status(404)
          .json({ error: "User not found in database. Please register first" });
      }

      // Fetch user's past messages for context
      const chatHistory = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(chats.createdAt)
        .limit(10)

      // Format chat history for open AI
      const conversation: ChatCompletionMessageParam[] = chatHistory.flatMap(
        (chat) => [
          { role: "user", content: chat.message },
          { role: "assistant", content: chat.reply },
        ] 
      );

      // Add latest user messages to the conversation
      conversation.push({
        role: "user",
        content: message,
      });

      // Send message to OpenAI GPT-4
      const response = await openAI.chat.completions.create({
        model: "gpt-4",
        messages: conversation as ChatCompletionMessageParam[],
      });

      const aiResponse =
        response.choices[0].message?.content ?? "No response from AI";

      // Save chat to database
      await db.insert(chats).values({
        userId,
        message,
        reply: aiResponse
      });  

      // Create or get Stream Chat channel
      const channel = chatClient.channel("messaging", `chat-${userId}`, {
        // name: "AI Chat",
        created_by_id: "ai_bot",
      });

      await channel.create();
      await channel.sendMessage({
        text: aiResponse,
        user_id: "ai_bot",
      });

      res.status(200).json({ reply: aiResponse });
    } catch (error) {
      console.log('Error generating AI response');
      res.status(500).json({ error: 'Internal server error' });
    }    
})


// Register user with Stream Chat 
app.post('/get-messages', async (req: Request, res: Response):Promise<any> => {
  const { userId } = req.body

  if (!userId) {
    return res
          .status(404)
          .json({ error: "User ID is required" });
  }

  try {
    const chatHistory = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))

      res.status(200).json({ messages: chatHistory });
  } catch (error) {
    console.log('Error fetching chat history', error)
    res.status(500).json({ error: "Internal server error" });
  }  
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => console.log(`Server runnin on port ${PORT}`))

 