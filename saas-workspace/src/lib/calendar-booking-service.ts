import {supabase} from './supabase';
export interface CalendarBookingInput {clientId:string;category:'call'|'shoot';title:string;startsAt:string;endsAt:string;location:string;note:string}
export async function requestCalendarBooking(input:CalendarBookingInput) {
  if(!supabase)throw new Error('Workspace connection unavailable.');
  const {error}=await supabase.rpc('request_calendar_booking',{p_client_id:input.clientId,p_category:input.category,p_title:input.title,p_starts_at:input.startsAt,p_ends_at:input.endsAt,p_location:input.location,p_note:input.note});
  if(error)throw new Error(error.message);
}
export async function decideCalendarBooking(id:string,confirm:boolean) {
  if(!supabase)throw new Error('Workspace connection unavailable.');
  const {error}=await supabase.rpc('decide_calendar_booking',{p_request_id:id,p_confirm:confirm});
  if(error)throw new Error(error.message);
}
