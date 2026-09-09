create type public.sales_document_type as enum (
  'general', 'script', 'offer', 'objection_handling', 'training', 'other'
);

alter table public.company_documents
  add column sales_document_type public.sales_document_type,
  add column caller_list text;

update public.company_documents set sales_document_type = 'general' where kind = 'sales';

alter table public.company_documents
  add constraint company_documents_sales_document_type_check
    check (sales_document_type is null or kind = 'sales'),
  add constraint company_documents_script_list_check
    check ((sales_document_type = 'script' and caller_list is not null and length(trim(caller_list)) > 0)
      or (sales_document_type is distinct from 'script' and caller_list is null));

create unique index company_documents_one_script_per_caller_list_idx
  on public.company_documents (agency_id, caller_list)
  where archived_at is null and sales_document_type = 'script';
