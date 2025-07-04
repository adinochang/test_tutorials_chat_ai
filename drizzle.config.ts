import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Load environment variables
config({ path: '.env' })

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!
    }
})