-- Update default send rate to 100/hour
alter table lead_batches alter column sends_per_hour set default 100;

-- Optional: update batches not yet completed
update lead_batches set sends_per_hour = 100 where sends_per_hour = 50 and status in ('draft', 'generating', 'review', 'sending');
 