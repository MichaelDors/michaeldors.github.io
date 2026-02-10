import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.94.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESENDAPP");

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BADGE_COLORS = [
  '#ff7b51', // Original Orange
  '#00b8b8ff', // Teal/Green
  '#c574e5ff', // Purple
  '#409b6dff', // Yellow/Gold
  '#f73d66ff', // Pink
  '#6495daff'  // Blue
];

const BADGE_SHAPES: string[] = [
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.4 L 51.7 1.4 L 52.5 2.8 L 53.2 4.5 L 53.8 6.2 L 54.5 7.5 L 55.1 8.2 L 55.9 8.3 L 56.7 7.8 L 57.6 6.7 L 58.7 5.3 L 59.8 3.8 L 60.9 2.6 L 62.0 1.8 L 62.9 1.7 L 63.7 2.3 L 64.2 3.5 L 64.6 5.1 L 64.8 6.9 L 65.0 8.7 L 65.3 10.1 L 65.8 11.0 L 66.4 11.3 L 67.4 10.9 L 68.6 10.1 L 70.0 9.0 L 71.4 7.9 L 72.9 7.0 L 74.1 6.6 L 75.0 6.7 L 75.6 7.4 L 75.8 8.7 L 75.7 10.4 L 75.5 12.2 L 75.2 14.0 L 75.1 15.4 L 75.3 16.4 L 75.9 16.8 L 76.9 16.8 L 78.3 16.3 L 79.9 15.6 L 81.6 14.9 L 83.2 14.4 L 84.5 14.3 L 85.4 14.6 L 85.7 15.5 L 85.6 16.8 L 85.1 18.4 L 84.4 20.1 L 83.7 21.7 L 83.2 23.1 L 83.2 24.1 L 83.6 24.7 L 84.6 24.9 L 86.0 24.8 L 87.8 24.5 L 89.6 24.3 L 91.3 24.2 L 92.6 24.4 L 93.3 25.0 L 93.4 25.9 L 93.0 27.1 L 92.1 28.6 L 91.0 30.0 L 89.9 31.4 L 89.1 32.6 L 88.7 33.6 L 89.0 34.2 L 89.9 34.7 L 91.3 35.0 L 93.1 35.2 L 94.9 35.4 L 96.5 35.8 L 97.7 36.3 L 98.3 37.1 L 98.2 38.0 L 97.4 39.1 L 96.2 40.2 L 94.7 41.3 L 93.3 42.4 L 92.2 43.3 L 91.7 44.1 L 91.8 44.9 L 92.5 45.5 L 93.8 46.2 L 95.5 46.8 L 97.2 47.5 L 98.6 48.3 L 99.6 49.1 L 100.0 50.0 L 99.6 50.9 L 98.6 51.7 L 97.2 52.5 L 95.5 53.2 L 93.8 53.8 L 92.5 54.5 L 91.8 55.1 L 91.7 55.9 L 92.2 56.7 L 93.3 57.6 L 94.7 58.7 L 96.2 59.8 L 97.4 60.9 L 98.2 62.0 L 98.3 62.9 L 97.7 63.7 L 96.5 64.2 L 94.9 64.6 L 93.1 64.8 L 91.3 65.0 L 89.9 65.3 L 89.0 65.8 L 88.7 66.4 L 89.1 67.4 L 89.9 68.6 L 91.0 70.0 L 92.1 71.4 L 93.0 72.9 L 93.4 74.1 L 93.3 75.0 L 92.6 75.6 L 91.3 75.8 L 89.6 75.7 L 87.8 75.5 L 86.0 75.2 L 84.6 75.1 L 83.6 75.3 L 83.2 75.9 L 83.2 76.9 L 83.7 78.3 L 84.4 79.9 L 85.1 81.6 L 85.6 83.2 L 85.7 84.5 L 85.4 85.4 L 84.5 85.7 L 83.2 85.6 L 81.6 85.1 L 79.9 84.4 L 78.3 83.7 L 76.9 83.2 L 75.9 83.2 L 75.3 83.6 L 75.1 84.6 L 75.2 86.0 L 75.5 87.8 L 75.7 89.6 L 75.8 91.3 L 75.6 92.6 L 75.0 93.3 L 74.1 93.4 L 72.9 93.0 L 71.4 92.1 L 70.0 91.0 L 68.6 89.9 L 67.4 89.1 L 66.4 88.7 L 65.8 89.0 L 65.3 89.9 L 65.0 91.3 L 64.8 93.1 L 64.6 94.9 L 64.2 96.5 L 63.7 97.7 L 62.9 98.3 L 62.0 98.2 L 60.9 97.4 L 59.8 96.2 L 58.7 94.7 L 57.6 93.3 L 56.7 92.2 L 55.9 91.7 L 55.1 91.8 L 54.5 92.5 L 53.8 93.8 L 53.2 95.5 L 52.5 97.2 L 51.7 98.6 L 50.9 99.6 L 50.0 100.0 L 49.1 99.6 L 48.3 98.6 L 47.5 97.2 L 46.8 95.5 L 46.2 93.8 L 45.5 92.5 L 44.9 91.8 L 44.1 91.7 L 43.3 92.2 L 42.4 93.3 L 41.3 94.7 L 40.2 96.2 L 39.1 97.4 L 38.0 98.2 L 37.1 98.3 L 36.3 97.7 L 35.8 96.5 L 35.4 94.9 L 35.2 93.1 L 35.0 91.3 L 34.7 89.9 L 34.2 89.0 L 33.6 88.7 L 32.6 89.1 L 31.4 89.9 L 30.0 91.0 L 28.6 92.1 L 27.1 93.0 L 25.9 93.4 L 25.0 93.3 L 24.4 92.6 L 24.2 91.3 L 24.3 89.6 L 24.5 87.8 L 24.8 86.0 L 24.9 84.6 L 24.7 83.6 L 24.1 83.2 L 23.1 83.2 L 21.7 83.7 L 20.1 84.4 L 18.4 85.1 L 16.8 85.6 L 15.5 85.7 L 14.6 85.4 L 14.3 84.5 L 14.4 83.2 L 14.9 81.6 L 15.6 79.9 L 16.3 78.3 L 16.8 76.9 L 16.8 75.9 L 16.4 75.3 L 15.4 75.1 L 14.0 75.2 L 12.2 75.5 L 10.4 75.7 L 8.7 75.8 L 7.4 75.6 L 6.7 75.0 L 6.6 74.1 L 7.0 72.9 L 7.9 71.4 L 9.0 70.0 L 10.1 68.6 L 10.9 67.4 L 11.3 66.4 L 11.0 65.8 L 10.1 65.3 L 8.7 65.0 L 6.9 64.8 L 5.1 64.6 L 3.5 64.2 L 2.3 63.7 L 1.7 62.9 L 1.8 62.0 L 2.6 60.9 L 3.8 59.8 L 5.3 58.7 L 6.7 57.6 L 7.8 56.7 L 8.3 55.9 L 8.2 55.1 L 7.5 54.5 L 6.2 53.8 L 4.5 53.2 L 2.8 52.5 L 1.4 51.7 L 0.4 50.9 L 0.0 50.0 L 0.4 49.1 L 1.4 48.3 L 2.8 47.5 L 4.5 46.8 L 6.2 46.2 L 7.5 45.5 L 8.2 44.9 L 8.3 44.1 L 7.8 43.3 L 6.7 42.4 L 5.3 41.3 L 3.8 40.2 L 2.6 39.1 L 1.8 38.0 L 1.7 37.1 L 2.3 36.3 L 3.5 35.8 L 5.1 35.4 L 6.9 35.2 L 8.7 35.0 L 10.1 34.7 L 11.0 34.2 L 11.3 33.6 L 10.9 32.6 L 10.1 31.4 L 9.0 30.0 L 7.9 28.6 L 7.0 27.1 L 6.6 25.9 L 6.7 25.0 L 7.4 24.4 L 8.7 24.2 L 10.4 24.3 L 12.2 24.5 L 14.0 24.8 L 15.4 24.9 L 16.4 24.7 L 16.8 24.1 L 16.8 23.1 L 16.3 21.7 L 15.6 20.1 L 14.9 18.4 L 14.4 16.8 L 14.3 15.5 L 14.6 14.6 L 15.5 14.3 L 16.8 14.4 L 18.4 14.9 L 20.1 15.6 L 21.7 16.3 L 23.1 16.8 L 24.1 16.8 L 24.7 16.4 L 24.9 15.4 L 24.8 14.0 L 24.5 12.2 L 24.3 10.4 L 24.2 8.7 L 24.4 7.4 L 25.0 6.7 L 25.9 6.6 L 27.1 7.0 L 28.6 7.9 L 30.0 9.0 L 31.4 10.1 L 32.6 10.9 L 33.6 11.3 L 34.2 11.0 L 34.7 10.1 L 35.0 8.7 L 35.2 6.9 L 35.4 5.1 L 35.8 3.5 L 36.3 2.3 L 37.1 1.7 L 38.0 1.8 L 39.1 2.6 L 40.2 3.8 L 41.3 5.3 L 42.4 6.7 L 43.3 7.8 L 44.1 8.3 L 44.9 8.2 L 45.5 7.5 L 46.2 6.2 L 46.8 4.5 L 47.5 2.8 L 48.3 1.4 L 49.1 0.4 L 50.0 0.0 Z" /></svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.2 L 51.7 1.0 L 52.5 2.1 L 53.3 3.4 L 53.9 4.9 L 54.6 6.2 L 55.2 7.4 L 55.9 8.2 L 56.6 8.5 L 57.3 8.4 L 58.2 7.9 L 59.1 7.0 L 60.2 5.9 L 61.3 4.7 L 62.4 3.6 L 63.5 2.8 L 64.5 2.4 L 65.5 2.4 L 66.2 3.0 L 66.8 3.9 L 67.2 5.2 L 67.5 6.7 L 67.7 8.3 L 67.9 9.8 L 68.1 11.1 L 68.5 12.0 L 69.1 12.6 L 69.8 12.7 L 70.8 12.4 L 72.0 11.9 L 73.3 11.2 L 74.7 10.4 L 76.1 9.7 L 77.4 9.3 L 78.5 9.2 L 79.4 9.5 L 79.9 10.3 L 80.2 11.3 L 80.2 12.7 L 80.0 14.2 L 79.7 15.8 L 79.4 17.3 L 79.3 18.6 L 79.3 19.6 L 79.7 20.3 L 80.4 20.7 L 81.4 20.7 L 82.7 20.6 L 84.2 20.3 L 85.8 20.0 L 87.3 19.8 L 88.7 19.8 L 89.7 20.1 L 90.5 20.6 L 90.8 21.5 L 90.7 22.6 L 90.3 23.9 L 89.6 25.3 L 88.8 26.7 L 88.1 28.0 L 87.6 29.2 L 87.3 30.2 L 87.4 30.9 L 88.0 31.5 L 88.9 31.9 L 90.2 32.1 L 91.7 32.3 L 93.3 32.5 L 94.8 32.8 L 96.1 33.2 L 97.0 33.8 L 97.6 34.5 L 97.6 35.5 L 97.2 36.5 L 96.4 37.6 L 95.3 38.7 L 94.1 39.8 L 93.0 40.9 L 92.1 41.8 L 91.6 42.7 L 91.5 43.4 L 91.8 44.1 L 92.6 44.8 L 93.8 45.4 L 95.1 46.1 L 96.6 46.7 L 97.9 47.5 L 99.0 48.3 L 99.8 49.1 L 100.0 50.0 L 99.8 50.9 L 99.0 51.7 L 97.9 52.5 L 96.6 53.3 L 95.1 53.9 L 93.8 54.6 L 92.6 55.2 L 91.8 55.9 L 91.5 56.6 L 91.6 57.3 L 92.1 58.2 L 93.0 59.1 L 94.1 60.2 L 95.3 61.3 L 96.4 62.4 L 97.2 63.5 L 97.6 64.5 L 97.6 65.5 L 97.0 66.2 L 96.1 66.8 L 94.8 67.2 L 93.3 67.5 L 91.7 67.7 L 90.2 67.9 L 88.9 68.1 L 88.0 68.5 L 87.4 69.1 L 87.3 69.8 L 87.6 70.8 L 88.1 72.0 L 88.8 73.3 L 89.6 74.7 L 90.3 76.1 L 90.7 77.4 L 90.8 78.5 L 90.5 79.4 L 89.7 79.9 L 88.7 80.2 L 87.3 80.2 L 85.8 80.0 L 84.2 79.7 L 82.7 79.4 L 81.4 79.3 L 80.4 79.3 L 79.7 79.7 L 79.3 80.4 L 79.3 81.4 L 79.4 82.7 L 79.7 84.2 L 80.0 85.8 L 80.2 87.3 L 80.2 88.7 L 79.9 89.7 L 79.4 90.5 L 78.5 90.8 L 77.4 90.7 L 76.1 90.3 L 74.7 89.6 L 73.3 88.8 L 72.0 88.1 L 70.8 87.6 L 69.8 87.3 L 69.1 87.4 L 68.5 88.0 L 68.1 88.9 L 67.9 90.2 L 67.7 91.7 L 67.5 93.3 L 67.2 94.8 L 66.8 96.1 L 66.2 97.0 L 65.5 97.6 L 64.5 97.6 L 63.5 97.2 L 62.4 96.4 L 61.3 95.3 L 60.2 94.1 L 59.1 93.0 L 58.2 92.1 L 57.3 91.6 L 56.6 91.5 L 55.9 91.8 L 55.2 92.6 L 54.6 93.8 L 53.9 95.1 L 53.3 96.6 L 52.5 97.9 L 51.7 99.0 L 50.9 99.8 L 50.0 100.0 L 49.1 99.8 L 48.3 99.0 L 47.5 97.9 L 46.7 96.6 L 46.1 95.1 L 45.4 93.8 L 44.8 92.6 L 44.1 91.8 L 43.4 91.5 L 42.7 91.6 L 41.8 92.1 L 40.9 93.0 L 39.8 94.1 L 38.7 95.3 L 37.6 96.4 L 36.5 97.2 L 35.5 97.6 L 34.5 97.6 L 33.8 97.0 L 33.2 96.1 L 32.8 94.8 L 32.5 93.3 L 32.3 91.7 L 32.1 90.2 L 31.9 88.9 L 31.5 88.0 L 30.9 87.4 L 30.2 87.3 L 29.2 87.6 L 28.0 88.1 L 26.7 88.8 L 25.3 89.6 L 23.9 90.3 L 22.6 90.7 L 21.5 90.8 L 20.6 90.5 L 20.1 89.7 L 19.8 88.7 L 19.8 87.3 L 20.0 85.8 L 20.3 84.2 L 20.6 82.7 L 20.7 81.4 L 20.7 80.4 L 20.3 79.7 L 19.6 79.3 L 18.6 79.3 L 17.3 79.4 L 15.8 79.7 L 14.2 80.0 L 12.7 80.2 L 11.3 80.2 L 10.3 79.9 L 9.5 79.4 L 9.2 78.5 L 9.3 77.4 L 9.7 76.1 L 10.4 74.7 L 11.2 73.3 L 11.9 72.0 L 12.4 70.8 L 12.7 69.8 L 12.6 69.1 L 12.0 68.5 L 11.1 68.1 L 9.8 67.9 L 8.3 67.7 L 6.7 67.5 L 5.2 67.2 L 3.9 66.8 L 3.0 66.2 L 2.4 65.5 L 2.4 64.5 L 2.8 63.5 L 3.6 62.4 L 4.7 61.3 L 5.9 60.2 L 7.0 59.1 L 7.9 58.2 L 8.4 57.3 L 8.5 56.6 L 8.2 55.9 L 7.4 55.2 L 6.2 54.6 L 4.9 53.9 L 3.4 53.3 L 2.1 52.5 L 1.0 51.7 L 0.2 50.9 L 0.0 50.0 L 0.2 49.1 L 1.0 48.3 L 2.1 47.5 L 3.4 46.7 L 4.9 46.1 L 6.2 45.4 L 7.4 44.8 L 8.2 44.1 L 8.5 43.4 L 8.4 42.7 L 7.9 41.8 L 7.0 40.9 L 5.9 39.8 L 4.7 38.7 L 3.6 37.6 L 2.8 36.5 L 2.4 35.5 L 2.4 34.5 L 3.0 33.8 L 3.9 33.2 L 5.2 32.8 L 6.7 32.5 L 8.3 32.3 L 9.8 32.1 L 11.1 31.9 L 12.0 31.5 L 12.6 30.9 L 12.7 30.2 L 12.4 29.2 L 11.9 28.0 L 11.2 26.7 L 10.4 25.3 L 9.7 23.9 L 9.3 22.6 L 9.2 21.5 L 9.5 20.6 L 10.3 20.1 L 11.3 19.8 L 12.7 19.8 L 14.2 20.0 L 15.8 20.3 L 17.3 20.6 L 18.6 20.7 L 19.6 20.7 L 20.3 20.3 L 20.7 19.6 L 20.7 18.6 L 20.6 17.3 L 20.3 15.8 L 20.0 14.2 L 19.8 12.7 L 19.8 11.3 L 20.1 10.3 L 20.6 9.5 L 21.5 9.2 L 22.6 9.3 L 23.9 9.7 L 25.3 10.4 L 26.7 11.2 L 28.0 11.9 L 29.2 12.4 L 30.2 12.7 L 30.9 12.6 L 31.5 12.0 L 31.9 11.1 L 32.1 9.8 L 32.3 8.3 L 32.5 6.7 L 32.8 5.2 L 33.2 3.9 L 33.8 3.0 L 34.5 2.4 L 35.5 2.4 L 36.5 2.8 L 37.6 3.6 L 38.7 4.7 L 39.8 5.9 L 40.9 7.0 L 41.8 7.9 L 42.7 8.4 L 43.4 8.5 L 44.1 8.2 L 44.8 7.4 L 45.4 6.2 L 46.1 4.9 L 46.7 3.4 L 47.5 2.1 L 48.3 1.0 L 49.1 0.2 L 50.0 0.0 Z" /></svg>`,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.2 L 51.7 0.6 L 52.5 1.4 L 53.3 2.4 L 54.1 3.5 L 54.8 4.7 L 55.4 5.8 L 56.1 6.9 L 56.7 7.8 L 57.3 8.4 L 58.0 8.8 L 58.8 8.8 L 59.6 8.6 L 60.4 8.2 L 61.4 7.5 L 62.4 6.7 L 63.5 5.9 L 64.6 5.1 L 65.7 4.4 L 66.8 3.9 L 67.8 3.6 L 68.7 3.7 L 69.5 4.0 L 70.2 4.6 L 70.7 5.5 L 71.1 6.6 L 71.4 7.9 L 71.7 9.3 L 71.8 10.6 L 72.0 11.9 L 72.2 13.0 L 72.5 14.0 L 72.9 14.7 L 73.5 15.2 L 74.2 15.4 L 75.1 15.4 L 76.2 15.2 L 77.4 14.9 L 78.7 14.6 L 80.0 14.2 L 81.3 14.0 L 82.6 13.8 L 83.7 13.9 L 84.6 14.1 L 85.4 14.6 L 85.9 15.4 L 86.1 16.3 L 86.2 17.4 L 86.0 18.7 L 85.8 20.0 L 85.4 21.3 L 85.1 22.6 L 84.8 23.8 L 84.6 24.9 L 84.6 25.8 L 84.8 26.5 L 85.3 27.1 L 86.0 27.5 L 87.0 27.8 L 88.1 28.0 L 89.4 28.2 L 90.7 28.3 L 92.1 28.6 L 93.4 28.9 L 94.5 29.3 L 95.4 29.8 L 96.0 30.5 L 96.3 31.3 L 96.4 32.2 L 96.1 33.2 L 95.6 34.3 L 94.9 35.4 L 94.1 36.5 L 93.3 37.6 L 92.5 38.6 L 91.8 39.6 L 91.4 40.4 L 91.2 41.2 L 91.2 42.0 L 91.6 42.7 L 92.2 43.3 L 93.1 43.9 L 94.2 44.6 L 95.3 45.2 L 96.5 45.9 L 97.6 46.7 L 98.6 47.5 L 99.4 48.3 L 99.8 49.1 L 100.0 50.0 L 99.8 50.9 L 99.4 51.7 L 98.6 52.5 L 97.6 53.3 L 96.5 54.1 L 95.3 54.8 L 94.2 55.4 L 93.1 56.1 L 92.2 56.7 L 91.6 57.3 L 91.2 58.0 L 91.2 58.8 L 91.4 59.6 L 91.8 60.4 L 92.5 61.4 L 93.3 62.4 L 94.1 63.5 L 94.9 64.6 L 95.6 65.7 L 96.1 66.8 L 96.4 67.8 L 96.3 68.7 L 96.0 69.5 L 95.4 70.2 L 94.5 70.7 L 93.4 71.1 L 92.1 71.4 L 90.7 71.7 L 89.4 71.8 L 88.1 72.0 L 87.0 72.2 L 86.0 72.5 L 85.3 72.9 L 84.8 73.5 L 84.6 74.2 L 84.6 75.1 L 84.8 76.2 L 85.1 77.4 L 85.4 78.7 L 85.8 80.0 L 86.0 81.3 L 86.2 82.6 L 86.1 83.7 L 85.9 84.6 L 85.4 85.4 L 84.6 85.9 L 83.7 86.1 L 82.6 86.2 L 81.3 86.0 L 80.0 85.8 L 78.7 85.4 L 77.4 85.1 L 76.2 84.8 L 75.1 84.6 L 74.2 84.6 L 73.5 84.8 L 72.9 85.3 L 72.5 86.0 L 72.2 87.0 L 72.0 88.1 L 71.8 89.4 L 71.7 90.7 L 71.4 92.1 L 71.1 93.4 L 70.7 94.5 L 70.2 95.4 L 69.5 96.0 L 68.7 96.3 L 67.8 96.4 L 66.8 96.1 L 65.7 95.6 L 64.6 94.9 L 63.5 94.1 L 62.4 93.3 L 61.4 92.5 L 60.4 91.8 L 59.6 91.4 L 58.8 91.2 L 58.0 91.2 L 57.3 91.6 L 56.7 92.2 L 56.1 93.1 L 55.4 94.2 L 54.8 95.3 L 54.1 96.5 L 53.3 97.6 L 52.5 98.6 L 51.7 99.4 L 50.9 99.8 L 50.0 100.0 L 49.1 99.8 L 48.3 99.4 L 47.5 98.6 L 46.7 97.6 L 45.9 96.5 L 45.2 95.3 L 44.6 94.2 L 43.9 93.1 L 43.3 92.2 L 42.7 91.6 L 42.0 91.2 L 41.2 91.2 L 40.4 91.4 L 39.6 91.8 L 38.6 92.5 L 37.6 93.3 L 36.5 94.1 L 35.4 94.9 L 34.3 95.6 L 33.2 96.1 L 32.2 96.4 L 31.3 96.3 L 30.5 96.0 L 29.8 95.4 L 29.3 94.5 L 28.9 93.4 L 28.6 92.1 L 28.3 90.7 L 28.2 89.4 L 28.0 88.1 L 27.8 87.0 L 27.5 86.0 L 27.1 85.3 L 26.5 84.8 L 25.8 84.6 L 24.9 84.6 L 23.8 84.8 L 22.6 85.1 L 21.3 85.4 L 20.0 85.8 L 18.7 86.0 L 17.4 86.2 L 16.3 86.1 L 15.4 85.9 L 14.6 85.4 L 14.1 84.6 L 13.9 83.7 L 13.8 82.6 L 14.0 81.3 L 14.2 80.0 L 14.6 78.7 L 14.9 77.4 L 15.2 76.2 L 15.4 75.1 L 15.4 74.2 L 15.2 73.5 L 14.7 72.9 L 14.0 72.5 L 13.0 72.2 L 11.9 72.0 L 10.6 71.8 L 9.3 71.7 L 7.9 71.4 L 6.6 71.1 L 5.5 70.7 L 4.6 70.2 L 4.0 69.5 L 3.7 68.7 L 3.6 67.8 L 3.9 66.8 L 4.4 65.7 L 5.1 64.6 L 5.9 63.5 L 6.7 62.4 L 7.5 61.4 L 8.2 60.4 L 8.6 59.6 L 8.8 58.8 L 8.8 58.0 L 8.4 57.3 L 7.8 56.7 L 6.9 56.1 L 5.8 55.4 L 4.7 54.8 L 3.5 54.1 L 2.4 53.3 L 1.4 52.5 L 0.6 51.7 L 0.2 50.9 L 0.0 50.0 L 0.2 49.1 L 0.6 48.3 L 1.4 47.5 L 2.4 46.7 L 3.5 45.9 L 4.7 45.2 L 5.8 44.6 L 6.9 43.9 L 7.8 43.3 L 8.4 42.7 L 8.8 42.0 L 8.8 41.2 L 8.6 40.4 L 8.2 39.6 L 7.5 38.6 L 6.7 37.6 L 5.9 36.5 L 5.1 35.4 L 4.4 34.3 L 3.9 33.2 L 3.6 32.2 L 3.7 31.3 L 4.0 30.5 L 4.6 29.8 L 5.5 29.3 L 6.6 28.9 L 7.9 28.6 L 9.3 28.3 L 10.6 28.2 L 11.9 28.0 L 13.0 27.8 L 14.0 27.5 L 14.7 27.1 L 15.2 26.5 L 15.4 25.8 L 15.4 24.9 L 15.2 23.8 L 14.9 22.6 L 14.6 21.3 L 14.2 20.0 L 14.0 18.7 L 13.8 17.4 L 13.9 16.3 L 14.1 15.4 L 14.6 14.6 L 15.4 14.1 L 16.3 13.9 L 17.4 13.8 L 18.7 14.0 L 20.0 14.2 L 21.3 14.6 L 22.6 14.9 L 23.8 15.2 L 24.9 15.4 L 25.8 15.4 L 26.5 15.2 L 27.1 14.7 L 27.5 14.0 L 27.8 13.0 L 28.0 11.9 L 28.2 10.6 L 28.3 9.3 L 28.6 7.9 L 28.9 6.6 L 29.3 5.5 L 29.8 4.6 L 30.5 4.0 L 31.3 3.7 L 32.2 3.6 L 33.2 3.9 L 34.3 4.4 L 35.4 5.1 L 36.5 5.9 L 37.6 6.7 L 38.6 7.5 L 39.6 8.2 L 40.4 8.6 L 41.2 8.8 L 42.0 8.8 L 42.7 8.4 L 43.3 7.8 L 43.9 6.9 L 44.6 5.8 L 45.2 4.7 L 45.9 3.5 L 46.7 2.4 L 47.5 1.4 L 48.3 0.6 L 49.1 0.2 L 50.0 0.0 Z" /></svg>`
  ,
  `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50.0 0.0 L 50.9 0.0 L 51.7 0.1 L 52.6 0.3 L 53.5 0.5 L 54.3 0.7 L 55.1 1.0 L 56.0 1.4 L 56.8 1.8 L 57.6 2.2 L 58.3 2.7 L 59.1 3.2 L 59.8 3.8 L 60.5 4.4 L 61.2 5.0 L 61.9 5.6 L 62.6 6.2 L 63.2 6.8 L 63.8 7.4 L 64.4 8.0 L 65.0 8.7 L 65.6 9.3 L 66.2 9.8 L 66.8 10.4 L 67.4 10.9 L 68.0 11.4 L 68.6 11.9 L 69.2 12.4 L 69.8 12.8 L 70.4 13.2 L 71.0 13.6 L 71.6 14.0 L 72.3 14.3 L 73.0 14.6 L 73.7 14.9 L 74.4 15.2 L 75.1 15.4 L 75.9 15.6 L 76.7 15.9 L 77.5 16.1 L 78.3 16.3 L 79.1 16.5 L 80.0 16.7 L 80.8 17.0 L 81.7 17.2 L 82.5 17.5 L 83.4 17.8 L 84.3 18.1 L 85.1 18.4 L 85.9 18.8 L 86.8 19.1 L 87.6 19.6 L 88.4 20.0 L 89.1 20.5 L 89.8 21.1 L 90.5 21.6 L 91.2 22.2 L 91.8 22.9 L 92.3 23.6 L 92.8 24.3 L 93.3 25.0 L 93.7 25.8 L 94.1 26.6 L 94.4 27.4 L 94.6 28.2 L 94.8 29.1 L 95.0 30.0 L 95.1 30.9 L 95.1 31.8 L 95.1 32.7 L 95.1 33.6 L 95.0 34.5 L 94.9 35.4 L 94.8 36.3 L 94.6 37.2 L 94.4 38.1 L 94.2 39.0 L 94.0 39.8 L 93.8 40.7 L 93.6 41.5 L 93.3 42.4 L 93.1 43.2 L 92.9 44.0 L 92.7 44.8 L 92.5 45.5 L 92.4 46.3 L 92.2 47.0 L 92.1 47.8 L 92.1 48.5 L 92.0 49.3 L 92.0 50.0 L 92.0 50.7 L 92.1 51.5 L 92.1 52.2 L 92.2 53.0 L 92.4 53.7 L 92.5 54.5 L 92.7 55.2 L 92.9 56.0 L 93.1 56.8 L 93.3 57.6 L 93.6 58.5 L 93.8 59.3 L 94.0 60.2 L 94.2 61.0 L 94.4 61.9 L 94.6 62.8 L 94.8 63.7 L 94.9 64.6 L 95.0 65.5 L 95.1 66.4 L 95.1 67.3 L 95.1 68.2 L 95.1 69.1 L 95.0 70.0 L 94.8 70.9 L 94.6 71.8 L 94.4 72.6 L 94.1 73.4 L 93.7 74.2 L 93.3 75.0 L 92.8 75.7 L 92.3 76.4 L 91.8 77.1 L 91.2 77.8 L 90.5 78.4 L 89.8 78.9 L 89.1 79.5 L 88.4 80.0 L 87.6 80.4 L 86.8 80.9 L 85.9 81.2 L 85.1 81.6 L 84.3 81.9 L 83.4 82.2 L 82.5 82.5 L 81.7 82.8 L 80.8 83.0 L 80.0 83.3 L 79.1 83.5 L 78.3 83.7 L 77.5 83.9 L 76.7 84.1 L 75.9 84.4 L 75.1 84.6 L 74.4 84.8 L 73.7 85.1 L 73.0 85.4 L 72.3 85.7 L 71.6 86.0 L 71.0 86.4 L 70.4 86.8 L 69.8 87.2 L 69.2 87.6 L 68.6 88.1 L 68.0 88.6 L 67.4 89.1 L 66.8 89.6 L 66.2 90.2 L 65.6 90.7 L 65.0 91.3 L 64.4 92.0 L 63.8 92.6 L 63.2 93.2 L 62.6 93.8 L 61.9 94.4 L 61.2 95.0 L 60.5 95.6 L 59.8 96.2 L 59.1 96.8 L 58.3 97.3 L 57.6 97.8 L 56.8 98.2 L 56.0 98.6 L 55.1 99.0 L 54.3 99.3 L 53.5 99.5 L 52.6 99.7 L 51.7 99.9 L 50.9 100.0 L 50.0 100.0 L 49.1 100.0 L 48.3 99.9 L 47.4 99.7 L 46.5 99.5 L 45.7 99.3 L 44.9 99.0 L 44.0 98.6 L 43.2 98.2 L 42.4 97.8 L 41.7 97.3 L 40.9 96.8 L 40.2 96.2 L 39.5 95.6 L 38.8 95.0 L 38.1 94.4 L 37.4 93.8 L 36.8 93.2 L 36.2 92.6 L 35.6 92.0 L 35.0 91.3 L 34.4 90.7 L 33.8 90.2 L 33.2 89.6 L 32.6 89.1 L 32.0 88.6 L 31.4 88.1 L 30.8 87.6 L 30.2 87.2 L 29.6 86.8 L 29.0 86.4 L 28.4 86.0 L 27.7 85.7 L 27.0 85.4 L 26.3 85.1 L 25.6 84.8 L 24.9 84.6 L 24.1 84.4 L 23.3 84.1 L 22.5 83.9 L 21.7 83.7 L 20.9 83.5 L 20.0 83.3 L 19.2 83.0 L 18.3 82.8 L 17.5 82.5 L 16.6 82.2 L 15.7 81.9 L 14.9 81.6 L 14.1 81.2 L 13.2 80.9 L 12.4 80.4 L 11.6 80.0 L 10.9 79.5 L 10.2 78.9 L 9.5 78.4 L 8.8 77.8 L 8.2 77.1 L 7.7 76.4 L 7.2 75.7 L 6.7 75.0 L 6.3 74.2 L 5.9 73.4 L 5.6 72.6 L 5.4 71.8 L 5.2 70.9 L 5.0 70.0 L 4.9 69.1 L 4.9 68.2 L 4.9 67.3 L 4.9 66.4 L 5.0 65.5 L 5.1 64.6 L 5.2 63.7 L 5.4 62.8 L 5.6 61.9 L 5.8 61.0 L 6.0 60.2 L 6.2 59.3 L 6.4 58.5 L 6.7 57.6 L 6.9 56.8 L 7.1 56.0 L 7.3 55.2 L 7.5 54.5 L 7.6 53.7 L 7.8 53.0 L 7.9 52.2 L 7.9 51.5 L 8.0 50.7 L 8.0 50.0 L 8.0 49.3 L 7.9 48.5 L 7.9 47.8 L 7.8 47.0 L 7.6 46.3 L 7.5 45.5 L 7.3 44.8 L 7.1 44.0 L 6.9 43.2 L 6.7 42.4 L 6.4 41.5 L 6.2 40.7 L 6.0 39.8 L 5.8 39.0 L 5.6 38.1 L 5.4 37.2 L 5.2 36.3 L 5.1 35.4 L 5.0 34.5 L 4.9 33.6 L 4.9 32.7 L 4.9 31.8 L 4.9 30.9 L 5.0 30.0 L 5.2 29.1 L 5.4 28.2 L 5.6 27.4 L 5.9 26.6 L 6.3 25.8 L 6.7 25.0 L 7.2 24.3 L 7.7 23.6 L 8.2 22.9 L 8.8 22.2 L 9.5 21.6 L 10.2 21.1 L 10.9 20.5 L 11.6 20.0 L 12.4 19.6 L 13.2 19.1 L 14.1 18.8 L 14.9 18.4 L 15.7 18.1 L 16.6 17.8 L 17.5 17.5 L 18.3 17.2 L 19.2 17.0 L 20.0 16.7 L 20.9 16.5 L 21.7 16.3 L 22.5 16.1 L 23.3 15.9 L 24.1 15.6 L 24.9 15.4 L 25.6 15.2 L 26.3 14.9 L 27.0 14.6 L 27.7 14.3 L 28.4 14.0 L 29.0 13.6 L 29.6 13.2 L 30.2 12.8 L 30.8 12.4 L 31.4 11.9 L 32.0 11.4 L 32.6 10.9 L 33.2 10.4 L 33.8 9.8 L 34.4 9.3 L 35.0 8.7 L 35.6 8.0 L 36.2 7.4 L 36.8 6.8 L 37.4 6.2 L 38.1 5.6 L 38.8 5.0 L 39.5 4.4 L 40.2 3.8 L 40.9 3.2 L 41.7 2.7 L 42.4 2.2 L 43.2 1.8 L 44.0 1.4 L 44.9 1.0 L 45.7 0.7 L 46.5 0.5 L 47.4 0.3 L 48.3 0.1 L 49.1 0.0 L 50.0 0.0 Z" /></svg>`
];

function stringToHash(str: string) {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

function getBadgeRotation() {
  // True random angle between -22 and 22 for every view
  let deg = Math.floor(Math.random() * 45) - 22;

  // Ensure it's not too close to 0 (perceived as "default" rather than random)
  // If result is between -5 and 5, push it out further
  if (Math.abs(deg) < 5) {
    deg += (deg >= 0 ? 10 : -10);
  }

  return deg;
}

function getBadgeColor(seedStr: string) {
  const hash = stringToHash(seedStr);
  const index = Math.abs(hash) % BADGE_COLORS.length;
  return BADGE_COLORS[index];
}

function getBadgeShape(seedStr: string) {
  if (BADGE_SHAPES.length === 0) return "";
  const hash = stringToHash(seedStr);
  const index = Math.abs(hash) % BADGE_SHAPES.length;
  return BADGE_SHAPES[index];
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error("RESENDAPP not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Cadence <team@cadence.michaeldors.com>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend failed: ${res.status} ${text}`);
  }
}

async function notifyOwnersAboutUnpublishedSets(unpublishedSets: Map<string, { set: any; team: any; alert: any }>) {
  console.log(`Notifying owners about ${unpublishedSets.size} unpublished sets with due alerts`);

  // Group by team owner
  const setsByOwner = new Map<string, Array<{ set: any; team: any; alert: any }>>();
  
  for (const { set, team, alert } of unpublishedSets.values()) {
    if (!team.owner_id) {
      console.warn(`Team ${team.id} has no owner_id, skipping notification`);
      continue;
    }
    
    const ownerId = team.owner_id;
    if (!setsByOwner.has(ownerId)) {
      setsByOwner.set(ownerId, []);
    }
    setsByOwner.get(ownerId)!.push({ set, team, alert });
  }

  // Load owner profiles
  const ownerIds = Array.from(setsByOwner.keys());
  if (ownerIds.length === 0) return;

  const { data: owners, error: ownersError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ownerIds);

  if (ownersError || !owners) {
    console.error("Error loading owner profiles:", ownersError);
    return;
  }

  const ownersById = new Map(owners.map((o: any) => [o.id, o]));

  // Send email to each owner
  for (const [ownerId, sets] of setsByOwner.entries()) {
    const owner = ownersById.get(ownerId);
    if (!owner || !owner.email) {
      console.warn(`Owner ${ownerId} not found or has no email`);
      continue;
    }

    const ownerName = owner.full_name || "Team Owner";
    const setsList = sets.map(({ set, alert }) => {
      const alertType = alert.time_type === "service" ? "service" : "rehearsal";
      const eventDate = alert.targetEventDate || set.scheduled_date;
      return `<li><strong>${set.title || "Untitled set"}</strong> - ${alertType} reminder scheduled for ${eventDate}</li>`;
    }).join("");

    const subject = `Action Required: Set Reminders Not Sent (${sets.length} ${sets.length === 1 ? 'set' : 'sets'})`;
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
    <meta name="color-scheme" content="light dark" />
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Google Sans Flex", "Segoe UI", sans-serif;
        color: #111827;
      }
      .wrapper {
        padding: 32px 16px;
      }
      .card {
        width: 100%;
        max-width: 520px;
        background: #ffffff;
        border-radius: 32px;
        border: 1px solid rgba(15, 23, 42, 0.12);
      }
      .card-inner {
        padding: 32px;
        text-align: left;
      }
      .title {
        margin: 0 0 12px 0;
        font-size: 24px;
        line-height: 1.3;
        color: #111827;
        font-weight: 700;
      }
      .body-copy {
        margin: 0 0 16px 0;
        font-size: 15px;
        line-height: 1.6;
        color: #374151;
      }
      .warning-box {
        background: #fef3c7;
        border: 1px solid #fbbf24;
        border-radius: 16px;
        padding: 16px;
        margin: 20px 0;
      }
      .warning-box p {
        margin: 0;
        color: #92400e;
        font-size: 14px;
        font-weight: 600;
      }
      ul {
        margin: 16px 0;
        padding-left: 24px;
      }
      li {
        margin: 8px 0;
        color: #374151;
        font-size: 15px;
        line-height: 1.6;
      }
      @media (prefers-color-scheme: dark) {
        body {
          background: #0a0a0a;
          color: #ffffff;
        }
        .card {
          background: #151515;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .title {
          color: #ffffff;
        }
        .body-copy {
          color: #e5e5e5;
        }
        .warning-box {
          background: #78350f;
          border-color: #fbbf24;
        }
        .warning-box p {
          color: #fef3c7;
        }
        li {
          color: #e5e5e5;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" class="wrapper">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card">
            <tr>
              <td class="card-inner">
                <h1 class="title">Set Reminders Not Sent</h1>
                <p class="body-copy">
                  Hi ${ownerName},
                </p>
                <p class="body-copy">
                  We attempted to send reminder emails for ${sets.length} ${sets.length === 1 ? 'set' : 'sets'} in your team, but the reminders could not be sent because the ${sets.length === 1 ? 'set has' : 'sets have'} not been published yet.
                </p>
                <div class="warning-box">
                  <p>Reminders are only sent for published sets. Please publish the ${sets.length === 1 ? 'set' : 'sets'} below to ensure team members receive their reminders.</p>
                </div>
                <p class="body-copy">
                  <strong>Sets with pending reminders:</strong>
                </p>
                <ul>
                  ${setsList}
                </ul>
                <p class="body-copy">
                  To publish a set, open it in Cadence and click the "Publish" button. Once published, future reminders will be sent automatically.
                </p>
                <p style="margin: 20px 0 0 0;">
                  <a
                    href="https://michaeldors.com/cadence"
                    style="
                      display: inline-block;
                      padding: 12px 24px;
                      background-color: #ff7b51;
                      color: #0a0a0a;
                      text-decoration: none;
                      border-radius: 96px;
                      font-weight: 600;
                      font-size: 15px;
                    "
                  >
                    Open Cadence
                  </a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
      await sendResendEmail(owner.email, subject, html);
      console.log(`Sent unpublished set notification to owner ${owner.email}`);
    } catch (err) {
      console.error(`Failed to send notification to owner ${owner.email}:`, err);
    }
  }
}

serve(async (req) => {
  console.log("🔔 Incoming request", {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    console.log(`❌ Method ${req.method} not allowed`);
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Removed global scheduling check in favor of per-team scheduling below

  const now = new Date();
  // Look back 24 hours to catch everything "around" today
  // We don't look ahead because we don't want to send future alerts early
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = now;

  console.log("⏰ process-time-alerts running", {
    now: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString()
  });

  // Load pending alerts
  console.log("Fetching pending alerts...");
  const { data: alerts, error: alertsError } = await supabaseAdmin
    .from("set_time_alerts")
    .select("id, set_id, team_id, time_type, time_id, offset_days, sent_at")
    .eq("enabled", true)
    .is("sent_at", null);

  if (alertsError) {
    console.error("Error loading set_time_alerts", alertsError);
    return new Response(JSON.stringify({ error: "failed_to_load_alerts" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!alerts || alerts.length === 0) {
    console.log("No pending alerts");
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceIds = alerts.filter(a => a.time_type === "service").map(a => a.time_id);
  const rehearsalIds = alerts.filter(a => a.time_type === "rehearsal").map(a => a.time_id);
  const setIds = Array.from(new Set(alerts.map(a => a.set_id)));
  const teamIds = Array.from(new Set(alerts.map(a => a.team_id)));

  const [servicesRes, rehearsalsRes, setsRes, teamsRes] = await Promise.all([
    serviceIds.length
      ? supabaseAdmin.from("service_times").select("id, set_id, service_time").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    rehearsalIds.length
      ? supabaseAdmin.from("rehearsal_times").select("id, set_id, rehearsal_date, rehearsal_time").in("id", rehearsalIds)
      : Promise.resolve({ data: [], error: null }),
    setIds.length
      ? supabaseAdmin.from("sets").select("id, title, scheduled_date, team_id, is_published").in("id", setIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabaseAdmin.from("teams").select("id, daily_reminder_time, timezone, daily_email_count, daily_email_limit, daily_email_count_date, owner_id").in("id", teamIds)
      : Promise.resolve({ data: [], error: null }),
  ] as const);

  if (servicesRes.error || rehearsalsRes.error || setsRes.error || teamsRes.error) {
    console.error("Error loading related rows", { servicesRes, rehearsalsRes, setsRes, teamsRes });
    return new Response(JSON.stringify({ error: "failed_to_load_related" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const servicesById = new Map(servicesRes.data?.map((r: any) => [r.id, r]));
  const rehearsalsById = new Map(rehearsalsRes.data?.map((r: any) => [r.id, r]));
  const setsById = new Map(setsRes.data?.map((r: any) => [r.id, r]));
  const teamsById = new Map(teamsRes.data?.map((r: any) => [r.id, r]));

  type DueAlert = typeof alerts[number] & { eventTs: Date; set: any; targetEventDate: string };
  // Track unpublished sets that have due alerts (for owner notification)
  const unpublishedSetsForNotification = new Map<string, { set: any; team: any; alert: any }>();
  
  // 4. Filter alerts based on team schedule and date match
  const dueAlerts: DueAlert[] = [];

  for (const alert of alerts) {
    const set = setsById.get(alert.set_id);
    if (!set) continue;

    const team = teamsById.get(alert.team_id);
    if (!team) {
      console.warn(`Team ${alert.team_id} not found for alert ${alert.id}`);
      continue;
    }

    // Check Team Schedule (Hour Match)
    const timezone = team.timezone || 'UTC';
    const reminderTime = team.daily_reminder_time || '09:00:00'; // Default to 9 AM if not set

    // Get current time in team's timezone
    const nowInTeamZone = new Date().toLocaleString("en-US", { timeZone: timezone });
    const teamDate = new Date(nowInTeamZone);
    const currentHour = teamDate.getHours();

    const [targetHourStr] = reminderTime.split(':');
    const targetHour = parseInt(targetHourStr, 10);

    const hourMatch = currentHour === targetHour;

    console.log(`⏰ Checking team schedule for team ${team.id}:`, {
      timezone,
      reminderTime,
      currentHour,
      targetHour,
      match: hourMatch
    });

    if (!hourMatch) {
      continue;
    }

    // Check Date Match (Target Date vs Today)
    const todayString = teamDate.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

    let targetEventDate = null;
    let eventTimeStr = null;

    if (alert.time_type === "service") {
      const st = servicesById.get(alert.time_id);
      if (st && set.scheduled_date && st.service_time) {
        targetEventDate = set.scheduled_date;
        eventTimeStr = st.service_time;
      }
    } else {
      const rt = rehearsalsById.get(alert.time_id);
      if (rt && rt.rehearsal_time) {
        targetEventDate = rt.rehearsal_date || set.scheduled_date;
        eventTimeStr = rt.rehearsal_time;
      }
    }

    if (!targetEventDate || !eventTimeStr) {
      console.warn(`Missing date/time for alert ${alert.id}`);
      continue;
    }

    // Calculate Trigger Date = Event Date + Offset
    const eventDateObj = new Date(targetEventDate);
    // Add offset (can be negative)
    eventDateObj.setDate(eventDateObj.getDate() + alert.offset_days);
    const triggerDateString = eventDateObj.toISOString().slice(0, 10);

    const dateMatch = triggerDateString === todayString;

    console.log(`Checking date match for alert ${alert.id}:`, {
      teamId: team.id,
      todayString,
      targetEventDate,
      offset: alert.offset_days,
      triggerDateString,
      match: dateMatch
    });

    if (dateMatch) {
      // Check if set is published before adding to due alerts
      if (set.is_published !== true) {
        console.log(`Skipping alert ${alert.id} for unpublished set ${set.id}`);
        // Track unpublished sets for owner notification
        const unpublishedSetKey = `${alert.team_id}:${alert.set_id}`;
        if (!unpublishedSetsForNotification.has(unpublishedSetKey)) {
          unpublishedSetsForNotification.set(unpublishedSetKey, { set, team, alert });
        }
        continue;
      }

      // Construct eventTs for email template
      const fullEventTs = new Date(`${targetEventDate}T${eventTimeStr}`);
      dueAlerts.push({ ...(alert as any), eventTs: fullEventTs, set, targetEventDate });
    }
  }

  // Send notifications to team owners about unpublished sets
  if (unpublishedSetsForNotification.size > 0) {
    await notifyOwnersAboutUnpublishedSets(unpublishedSetsForNotification);
  }

  if (dueAlerts.length === 0) {
    console.log("No alerts in this window");
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Found ${dueAlerts.length} due alerts`);

  // Group due alerts by set for recipient lookup
  const dueSetIds = Array.from(new Set(dueAlerts.map(a => a.set_id)));

  const [setAssignmentsRes, songAssignmentsRes] = await Promise.all([
    supabaseAdmin
      .from("set_assignments")
      .select("set_id, person_id, person_email, pending_invite_id, role")
      .in("set_id", dueSetIds),
    supabaseAdmin
      .from("song_assignments")
      .select("set_song:set_song_id(set_id), person_id, person_email, pending_invite_id, role")
      .in("set_song.set_id", dueSetIds),
  ] as const);

  if (setAssignmentsRes.error || songAssignmentsRes.error) {
    console.error("Error loading assignments", { setAssignmentsRes, songAssignmentsRes });
    return new Response(JSON.stringify({ error: "failed_to_load_assignments" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build recipients per set (unique by person / invite / email)
  type Recipient = { person_id: string | null; pending_invite_id: string | null; person_email: string | null };
  const recipientsBySet = new Map<string, Recipient[]>();

  const addRecipient = (setId: string, r: Recipient) => {
    const key = r.person_id
      ? `person:${r.person_id}`
      : r.pending_invite_id
        ? `invite:${r.pending_invite_id}`
        : r.person_email
          ? `email:${r.person_email.toLowerCase()}`
          : null;
    if (!key) return;

    let bucket = recipientsBySet.get(setId);
    if (!bucket) {
      bucket = [];
      recipientsBySet.set(setId, bucket);
      (bucket as any)._keys = new Set<string>();
    }
    const keys: Set<string> = (bucket as any)._keys;
    if (keys.has(key)) return;
    keys.add(key);
    bucket.push(r);
  };

  (setAssignmentsRes.data || []).forEach((a: any) => {
    addRecipient(a.set_id, {
      person_id: a.person_id ?? null,
      pending_invite_id: a.pending_invite_id ?? null,
      person_email: a.person_email ?? null,
    });
  });

  (songAssignmentsRes.data || []).forEach((a: any) => {
    if (!a.set_song?.set_id) return;
    addRecipient(a.set_song.set_id, {
      person_id: a.person_id ?? null,
      pending_invite_id: a.pending_invite_id ?? null,
      person_email: a.person_email ?? null,
    });
  });

  // Fetch ALL times for the due sets to display in the email
  const [allServicesRes, allRehearsalsRes] = await Promise.all([
    supabaseAdmin
      .from("service_times")
      .select("id, set_id, service_time")
      .in("set_id", dueSetIds)
      .order("service_time"),
    supabaseAdmin
      .from("rehearsal_times")
      .select("id, set_id, rehearsal_date, rehearsal_time")
      .in("set_id", dueSetIds)
      .order("rehearsal_date")
      .order("rehearsal_time"),
  ] as const);

  const allServicesBySet = new Map<string, any[]>();
  (allServicesRes.data || []).forEach((s: any) => {
    const list = allServicesBySet.get(s.set_id) || [];
    list.push(s);
    allServicesBySet.set(s.set_id, list);
  });

  const allRehearsalsBySet = new Map<string, any[]>();
  (allRehearsalsRes.data || []).forEach((r: any) => {
    const list = allRehearsalsBySet.get(r.set_id) || [];
    list.push(r);
    allRehearsalsBySet.set(r.set_id, list);
  });

  // Resolve emails from profiles / pending_invites
  const allPersonIds = Array.from(
    new Set(
      Array.from(recipientsBySet.values())
        .flat()
        .map(r => r.person_id)
        .filter(Boolean) as string[],
    ),
  );
  const allInviteIds = Array.from(
    new Set(
      Array.from(recipientsBySet.values())
        .flat()
        .map(r => r.pending_invite_id)
        .filter(Boolean) as string[],
    ),
  );

  const [profilesRes, invitesRes] = await Promise.all([
    allPersonIds.length
      ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", allPersonIds)
      : Promise.resolve({ data: [], error: null }),
    allInviteIds.length
      ? supabaseAdmin.from("pending_invites").select("id, email, full_name").in("id", allInviteIds)
      : Promise.resolve({ data: [], error: null }),
  ] as const);

  const profilesById = new Map(profilesRes.data?.map((p: any) => [p.id, p]));
  const invitesById = new Map(invitesRes.data?.map((i: any) => [i.id, i]));

  // Calculate total emails to be sent per team
  const emailsPerTeam = new Map<string, number>();

  for (const alert of dueAlerts) {
    const setRecipients = recipientsBySet.get(alert.set_id) || [];
    if (setRecipients.length === 0) continue;

    const current = emailsPerTeam.get(alert.team_id) || 0;
    emailsPerTeam.set(alert.team_id, current + setRecipients.length);
  }

  // Check limits and update DB (Reservation Style)
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const updatePromises = [];

  for (const [teamId, count] of emailsPerTeam.entries()) {
    const team = teamsById.get(teamId);
    if (!team) continue;

    let currentCount = team.daily_email_count || 0;
    const countDate = team.daily_email_count_date;

    // Reset if different day
    if (countDate !== today) {
      currentCount = 0;
    }

    const limit = team.daily_email_limit;

    // Check limit
    if (limit !== null && limit !== undefined) {
      if (currentCount + count > limit) {
        console.warn(`Team ${teamId} hit daily email limit (${limit}). Requested: ${count}, Current: ${currentCount}`);
        return new Response(
          JSON.stringify({
            error: "daily_email_limit_exceeded",
            message: "This team has reached its daily email limit. Please contact support if you think this is a mistake.",
            details: { limit, currentCount, attemptedToSend: count },
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Reserve the count
    const newCount = currentCount + count;
    console.log(`Reserving email count for team ${teamId}: ${currentCount} + ${count} = ${newCount}`);

    updatePromises.push(
      supabaseAdmin
        .from("teams")
        .update({
          daily_email_count: newCount,
          daily_email_count_date: today
        })
        .eq("id", teamId)
    );
  }

  // Wait for all updates to finish before sending
  await Promise.all(updatePromises);

  let sentCount = 0;
  // Track sent emails to prevent duplicates in the same run
  // Format: "email|subject|bodyHash" (using simple string concat for uniqueness)
  const sentEmails = new Set<string>();

  const alertProcessingPromises = dueAlerts.map(async (alert) => {
    const set = alert.set;
    const setRecipients = recipientsBySet.get(alert.set_id) || [];
    console.log(`Processing due alert ${alert.id} for set ${alert.set_id}`, { recipientCount: setRecipients.length });

    if (!setRecipients.length) {
      console.log("No recipients for set", alert.set_id);
      return 0;
    }

    const subjectPrefix = alert.time_type === "service" ? "Service reminder" : "Rehearsal reminder";
    const subject = `${subjectPrefix}: ${set.title || "Untitled set"}`;
    const eventStr = alert.eventTs.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    // Generate Times Section HTML
    const setServices = allServicesBySet.get(alert.set_id) || [];
    const setRehearsals = allRehearsalsBySet.get(alert.set_id) || [];

    let timesHtml = '';

    if (setServices.length > 0) {
      timesHtml += `
            <div style="margin-top: 24px;">
                <h3 class="time-section-header" style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-church" style="color: #ff7b51;"></i> Service Times
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
            `;

      setServices.forEach(s => {
        let timeDisplay = s.service_time;
        try {
          const [hours, minutes] = s.service_time.split(':');
          const date = new Date();
          date.setHours(parseInt(hours), parseInt(minutes));
          timeDisplay = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
          // fallback
        }

        const dateDisplay = set.scheduled_date ? new Date(set.scheduled_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

        timesHtml += `
                    <div class="time-item" style="padding: 12px 12px 12px 20px; background: #ffffff; border-radius: 16px; border: 1px solid rgba(0, 0, 0, 0.15); margin-bottom: 8px;">
                        <div class="time-text" style="font-weight: 600; color: #111827; font-size: 14px;">${timeDisplay}</div>
                        ${dateDisplay ? `<div class="time-subtext" style="color: #6b7280; font-size: 13px; margin-top: 4px;">${dateDisplay}</div>` : ''}
                    </div>
                `;
      });

      timesHtml += `</div></div>`;
    }

    if (setRehearsals.length > 0) {
      timesHtml += `
            <div style="margin-top: 24px;">
                <h3 class="time-section-header" style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-guitar" style="color: #ff7b51;"></i> Rehearsal Times
                </h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
            `;

      setRehearsals.forEach(r => {
        let timeDisplay = r.rehearsal_time;
        try {
          const [hours, minutes] = r.rehearsal_time.split(':');
          const date = new Date();
          date.setHours(parseInt(hours), parseInt(minutes));
          timeDisplay = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
          // fallback
        }

        const dateDisplay = r.rehearsal_date ? new Date(r.rehearsal_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

        timesHtml += `
                    <div class="time-item" style="padding: 12px 12px 12px 20px; background: #ffffff; border-radius: 16px; border: 1px solid rgba(0, 0, 0, 0.15); margin-bottom: 8px;">
                        <div class="time-text" style="font-weight: 600; color: #111827; font-size: 14px;">${timeDisplay}</div>
                        ${dateDisplay ? `<div class="time-subtext" style="color: #6b7280; font-size: 13px; margin-top: 4px;">${dateDisplay}</div>` : ''}
                    </div>
                `;
      });

      timesHtml += `</div></div>`;
    }

    const emailPromises = setRecipients.map(async (r) => {
      let email = r.person_email?.toLowerCase() || null;
      let name: string | null = null;

      if (!email && r.person_id) {
        const profile = profilesById.get(r.person_id);
        email = profile?.email?.toLowerCase() ?? null;
        name = profile?.full_name ?? null;
      }

      if (!email && r.pending_invite_id) {
        const inv = invitesById.get(r.pending_invite_id);
        email = inv?.email?.toLowerCase() ?? null;
        name = name || (inv?.full_name ?? null);
      }

      if (!email) {
        console.warn("Skipping recipient with no email", r);
        return 0;
      }

      // Deduplication Check
      // We use a simple signature of email + subject + body length (as a proxy for content)
      // Ideally we'd hash the body but length + subject + recipient is likely unique enough for this context
      // to avoid sending the exact same email twice in the same run.
      const emailSignature = `${email}|${subject}|${timesHtml.length}`;

      if (sentEmails.has(emailSignature)) {
        console.log(`Skipping duplicate email to ${email} with subject "${subject}"`);
        // Return 1 so it counts as "sent" for the alert logic (so we don't keep trying to send it)
        return 1;
      }

      console.log(`Sending email to ${email} for alert ${alert.id}`);

      const greetingName = name ? ` ${name}` : "";
      const title = alert.time_type === "service" ? "Service Reminder" : "Rehearsal Reminder";
      const mainLine = `This is a reminder for the ${alert.time_type === "service" ? "service" : "rehearsal"} in the set <strong>${set.title || "Untitled set"}</strong> at <strong>${eventStr}</strong>.`;
      const finePrint = "You are receiving this reminder because you are scheduled for this set.";

      // Collect roles for this recipient
      const recipientRoles = new Set<string>();

      // Check set assignments
      (setAssignmentsRes.data || []).forEach((a: any) => {
        if (a.set_id === alert.set_id && a.role) {
          const isMatch =
            (a.person_id && a.person_id === r.person_id) ||
            (a.pending_invite_id && a.pending_invite_id === r.pending_invite_id) ||
            (a.person_email && email && a.person_email.toLowerCase() === email);

          if (isMatch) recipientRoles.add(a.role);
        }
      });

      // Check song assignments
      (songAssignmentsRes.data || []).forEach((a: any) => {
        if (a.set_song?.set_id === alert.set_id && a.role) {
          const isMatch =
            (a.person_id && a.person_id === r.person_id) ||
            (a.pending_invite_id && a.pending_invite_id === r.pending_invite_id) ||
            (a.person_email && email && a.person_email.toLowerCase() === email);

          if (isMatch) recipientRoles.add(a.role);
        }
      });

      let roleString = "";
      const roles = Array.from(recipientRoles).sort();

      if (roles.length > 0) {
        if (roles.length === 1) {
          roleString = roles[0];
        } else if (roles.length === 2) {
          roleString = `${roles[0]} and ${roles[1]}`;
        } else {
          const last = roles.pop();
          roleString = `${roles.join(", ")}, and ${last}`;
        }
      }

      const roleHtml = roleString
        ? `<p class="body-copy" style="margin-top: 12px;">You're requested for: <strong>${roleString}</strong></p>`
        : "";

      // Badge Logic
      let badgeHtml = "";
      if (set.scheduled_date) {
        const team = teamsById.get(alert.team_id) as any;
        const timezone = team?.timezone || 'UTC';

        // Get "Today" in team's timezone to ensure countdown matches user's wall clock
        const nowInTeamZone = new Date().toLocaleString("en-US", { timeZone: timezone });
        const teamNow = new Date(nowInTeamZone);
        const today = new Date(teamNow.getFullYear(), teamNow.getMonth(), teamNow.getDate());


        // Use the specific event timestamp triggering this alert (Service or Rehearsal)
        // We use targetEventDate (YYYY-MM-DD) which is the raw date string from DB, ensuring no timezone shifts occur
        const rawTargetDate = alert.targetEventDate || set.scheduled_date;
        let target = new Date(NaN); // Default to invalid

        if (rawTargetDate) {
          const parts = rawTargetDate.split('-');
          if (parts.length === 3) {
            // Construct comparison date using the raw YYYY-MM-DD values
            // Since 'today' was constructed using new Date(y,m,d) from the team's perspective, 
            // we do the same here to compare "apples to apples" (midnight to midnight)
            target = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          }
        }

        if (!isNaN(target.getTime())) {
          const diffTime = target.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= 0) {
            const label = diffDays === 0 ? "TODAY" : diffDays === 1 ? "DAY" : "DAYS";
            // Playful random values
            const seed = String(set.id || "0") + String(set.scheduled_date || "");
            const rotation = getBadgeRotation();
            const color = getBadgeColor(seed);
            let badgeShape = getBadgeShape(seed + "shape");

            // Inject color and styles into inner SVG
            if (badgeShape) {
              badgeShape = badgeShape.replace('<svg ', `<svg style="width: 100%; height: 100%; fill: ${color}; display: block; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));" `);
            }

            badgeHtml = `
                    <div class="countdown-badge" style="transform: rotate(${rotation}deg);">
                        ${badgeShape}
                        <div class="countdown-content">
                            ${diffDays > 0 ? `<div class="countdown-number">${diffDays}</div>` : ''}
                            <div class="countdown-label" style="${diffDays === 0 ? 'font-size: 16px; font-weight: 800;' : ''}">${label}</div>
                        </div>
                    </div>
                    `;
          }
        }
      }

      const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${subject}</title>
    <meta name="color-scheme" content="light dark" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
    <style>
      :root {
        color-scheme: light dark;
      }
      /* Default = light mode */
      body {
        margin: 0;
        padding: 0;
        background: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Google Sans Flex", "Segoe UI", sans-serif;
        color: #111827;
      }
      .countdown-badge {
        width: 100px;
        height: 100px;
        position: relative;
        display: block;
        /* Default rotation if JS fails (but it won't here) */
        transform: rotate(0deg); 
      }
      .countdown-badge svg {
        fill: var(--badge-color, #ff7b51);
        width: 100%;
        height: 100%;
        /* Drop shadow on the SVG path itself */
        filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
      }
      .countdown-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        /* Using a high contrast color against the bright badge colors */
        color: #f3f0e5;
        line-height: 1;
        width: 100%;

      }
      .countdown-number {
        font-size: 32px;
        font-weight: 800;
        margin-bottom: 0;
        line-height: 1;
      }
      .countdown-label {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-top: 2px;
      }
      .wrapper {
        padding: 32px 16px;
      }
      .card {
        width: 100%;
        max-width: 520px;
        background: #ffffff;
        border-radius: 32px;
        border: 1px solid rgba(15, 23, 42, 0.12);
      }
      .card-inner {
        padding: 32px 32px 24px 32px;
        text-align: left;
      }
      .card-footer {
        padding: 4px 32px 32px 32px;
      }
      .eyebrow {
        margin: 0 0 12px 0;
        font-size: 13px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 600;
      }
      .title {
        margin: 0 0 12px 0;
        font-size: 24px;
        line-height: 1.3;
        color: #111827;
        font-weight: 700;
      }
      .body-copy {
        margin: 0;
        font-size: 15px;
        line-height: 1.6;
        color: #374151;
      }
      .fine-print {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: #6b7280;
      }
      .highlight {
        color: #ff7b51;
        font-weight: 600;
      }
      /* Button styles matching app */
      .btn {
        border: none;
        border-radius: 96px;
        padding: 12px 24px;
        cursor: pointer;
        font-size: 15px;
        font-weight: 600;
        text-decoration: none;
        display: inline-block;
        /* Simulating ::before inner shadow */
        box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.3), inset 0 0 18px rgba(255, 255, 255, 0.3);
        position: relative;
      }
      .btn.primary {
        background-color: #ff7b51;
        /* Simulating ::after gradient sheen using background-image on top of color */
        background-image: linear-gradient(to bottom right, rgba(255, 255, 255, 0.2), transparent);
        color: #0a0a0a;
        border: 1px solid #ff7b51;
      }

      /* Dark mode overrides */
      @media (prefers-color-scheme: dark) {
        body {
          background: #0a0a0a;
          color: #ffffff;
        }
        .card {
          background: #151515;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .eyebrow {
          color: #a0a0a0;
        }
        .title {
          color: #ffffff;
        }
        .body-copy {
          color: #e5e5e5;
        }
        .fine-print {
          color: #a0a0a0;
        }
        .time-section-header {
            color: #ffffff !important;
        }
        .time-item {
            background: #1a1a1a !important;
            border-color: rgba(255, 255, 255, 0.12) !important;
        }
        .time-text {
            color: #ffffff !important;
        }
        .time-subtext {
            color: #a0a0a0 !important;
        }
        .countdown-content {
            color: #000000 !important;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" class="wrapper">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" class="card">
            <tr>
              <td class="card-inner">
                <!-- Header with Badge -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" valign="top">
                        <p class="eyebrow">
                          Cadence
                        </p>
                        <h1 class="title">
                          ${title}
                        </h1>
                    </td>
                    ${badgeHtml ? `
                    <td align="right" valign="top" width="100" style="padding-left: 16px;">
                        ${badgeHtml}
                    </td>
                    ` : ''}
                  </tr>
                </table>

                <p class="body-copy">
                  Hey${greetingName},<br /><br />
                  ${mainLine}
                </p>
                ${roleHtml}

                ${timesHtml}

                <p style="margin: 20px 0 0 0;">
                  <a
                    href="https://michaeldors.com/cadence"
                    class="btn primary"
                    style="
                      border: none;
                      border-radius: 96px;
                      padding: 12px 24px;
                      cursor: pointer;
                      font-size: 15px;
                      font-weight: 600;
                      text-decoration: none;
                      display: inline-block;
                      background-color: #ff7b51;
                      background-image: linear-gradient(to bottom right, rgba(255, 255, 255, 0.2), transparent);
                      box-shadow: inset 0 1.5px 0 rgba(255, 255, 255, 0.3), inset 0 0 18px rgba(255, 255, 255, 0.3);
                      color: #0a0a0a;
                    "
                  >
                    Open Cadence
                  </a>
                </p>
              </td>
            </tr>
            <tr>
              <td class="card-footer">
                <p class="fine-print">
                  ${finePrint}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

      try {
        await sendResendEmail(email, subject, html);
        sentEmails.add(emailSignature);

        return 1;
      } catch (err) {
        console.error("Failed to send reminder email", err);
        return 0;
      }
    });

    const results = await Promise.all(emailPromises);
    const emailsSentForAlert = results.reduce((a: number, b) => a + b, 0);

    // Mark alert as sent so it doesn't fire again
    const { error: updateError } = await supabaseAdmin
      .from("set_time_alerts")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", alert.id);

    if (updateError) {
      console.error("Failed to mark alert as sent", updateError);
    }

    return emailsSentForAlert;
  });

  const results = await Promise.all(alertProcessingPromises);
  sentCount = results.reduce((a: number, b) => a + b, 0);

  return new Response(JSON.stringify({ ok: true, processed: dueAlerts.length, emailsSent: sentCount }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
