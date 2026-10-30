import {sqliteTable,text,index} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{
 id:text('id').primaryKey(),kind:text('kind').notNull(),owner:text('owner').notNull(),target:text('target').notNull().default(''),data:text('data').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('records_kind_owner').on(t.kind,t.owner),index('records_kind_target').on(t.kind,t.target)]);
