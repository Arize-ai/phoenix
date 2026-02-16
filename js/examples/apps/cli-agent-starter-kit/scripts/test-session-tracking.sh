#!/bin/bash
# Test script to demonstrate multiple turns in the same session

{
  sleep 2
  echo "What is 10 + 5?"
  sleep 5
  echo "What time is it now?"
  sleep 5
  echo "Calculate 100 divided by 4"
  sleep 5
  echo "/exit"
} | pnpm start
