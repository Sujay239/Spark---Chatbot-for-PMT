-- NerveSpa Dashboard: PostgreSQL Queries
-- Based on the provided table structures: predefined_questions & chat_messages

-- 1. OVERVIEW PAGE METRICS
---------------------------------------------------------

-- Total Questions in Knowledge Base
SELECT COUNT(*) AS total_predefined_questions FROM predefined_questions;

-- Total User Sessions (Unique session IDs)
SELECT COUNT(DISTINCT session_id) AS total_sessions FROM chat_messages WHERE is_dev = false;

-- Total Messages excluding Developer mode
SELECT COUNT(*) AS total_live_messages FROM chat_messages WHERE is_dev = false;

-- Daily Chatbot Usage (Last 30 Days)
SELECT 
    DATE(created_at) as chat_day, 
    COUNT(*) as message_count 
FROM chat_messages 
WHERE created_at > NOW() - INTERVAL '30 days' AND is_dev = false
GROUP BY chat_day
ORDER BY chat_day ASC;


-- 2. QUESTIONS & ANSWERS MANAGER
---------------------------------------------------------

-- Fetch All Q&A Entries for the table
SELECT id, question, answer, created_at, content FROM predefined_questions ORDER BY created_at DESC;

-- Search Q&A (by keyword)
SELECT id, question, answer FROM predefined_questions 
WHERE question ILIKE '%keyword%' OR answer ILIKE '%keyword%';


-- 3. TESTING REPORT METRICS
---------------------------------------------------------

-- Number of Sessions (Last 30 Days)
SELECT COUNT(DISTINCT session_id) FROM chat_messages WHERE created_at > NOW() - INTERVAL '30 days' AND is_dev = false;

-- Most Asked Questions (User Intent Approximation)
-- Filters out gibberish, very short messages, and calculates an approximate match rate
WITH ordered_messages AS (
    SELECT 
        session_id, 
        role, 
        message, 
        created_at,
        LEAD(role) OVER (PARTITION BY session_id ORDER BY created_at) as next_role,
        LEAD(message) OVER (PARTITION BY session_id ORDER BY created_at) as next_message
    FROM chat_messages
    WHERE is_dev = false
      AND created_at > NOW() - INTERVAL '30 days'
)
SELECT 
    message AS user_question,
    COUNT(*) AS frequency,
    ROUND(
        AVG(
            CASE 
                WHEN next_role IN ('assistant', 'bot') AND 
                     (next_message ILIKE '%sorry%' OR next_message ILIKE '%don''t know%' OR next_message ILIKE '%unable%' OR next_message ILIKE '%couldn''t find%') 
                THEN 0
                WHEN next_role IN ('assistant', 'bot') THEN 100
                ELSE 0 
            END
        )::numeric, 1
    ) AS match_rate
FROM ordered_messages
WHERE role = 'user'
  -- Filter out gibberish (must contain at least one letter and be > 3 chars)
  AND LENGTH(TRIM(message)) > 3
  AND message ~ '[a-zA-Z]'
GROUP BY message
ORDER BY frequency DESC
LIMIT 10;


-- Total Fallbacks (Inferred from bot responses indicating uncertainty)
SELECT COUNT(*) as total_fallbacks 
FROM chat_messages 
WHERE role = 'assistant' 
  AND (message ILIKE '%sorry%' OR message ILIKE '%don''t know%' OR message ILIKE '%unable%');

-- Success Rate Percentage
-- Calculated as (1 - (Fallbacks / Total Assistant Messages)) * 100
SELECT 
    ROUND(((1 - (COUNT(*) FILTER (WHERE role = 'assistant' AND (message ILIKE '%sorry%' OR message ILIKE '%don''t know%'))::float / NULLIF(COUNT(*) FILTER (WHERE role = 'assistant'), 0))) * 100)::numeric, 2) as success_rate
FROM chat_messages;

-- User Interactivity (Messages per Session)
SELECT session_id, COUNT(*) as interactions, MAX(created_at) as created_at
FROM chat_messages 
GROUP BY session_id 
ORDER BY interactions DESC;

-- Hourly Interaction Heatmap (Distribution across 24 hours)
SELECT 
    EXTRACT(HOUR FROM created_at) as interaction_hour, 
    COUNT(*) as activity_count 
FROM chat_messages 
GROUP BY interaction_hour 
ORDER BY interaction_hour ASC;
