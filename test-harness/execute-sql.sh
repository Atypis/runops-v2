#!/bin/bash

# Load environment variables
source ./operator/.env

# Extract database connection details from Supabase URL
# Format: https://[PROJECT_ID].supabase.co
PROJECT_ID=$(echo $SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')

# Construct PostgreSQL connection string
# Supabase database URL format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres
DATABASE_URL="postgresql://postgres.${PROJECT_ID}:${SUPABASE_SERVICE_KEY}@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

echo "Executing SQL to create workflow_memory table..."
echo ""

# Execute the SQL file
psql "$DATABASE_URL" -f workflow_memory_table.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "Successfully created workflow_memory table!"
else
    echo ""
    echo "Error creating table. Please check the connection and try again."
    exit 1
fi