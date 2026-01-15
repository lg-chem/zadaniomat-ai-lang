-- Enable pgvector extension (run this first in Neon dashboard or here)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to KnowledgeEntry
-- Using 768 dimensions for Google's text-embedding-004 model
ALTER TABLE "KnowledgeEntry" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Create index for faster similarity search
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_embedding_idx" ON "KnowledgeEntry"
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- Add embedding column to AIConversation for learning from chats
ALTER TABLE "AIConversation" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Create index for conversation embeddings
CREATE INDEX IF NOT EXISTS "AIConversation_embedding_idx" ON "AIConversation"
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
