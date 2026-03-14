export type WikiVisibilityState = "hidden" | "title_only" | "partial" | "full";

export type WikiCategory = {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  description: string | null;
  parent_id: number | null;
  created_at: string;
};

export type WikiLinkedEntry = {
  id: number;
  title: string;
};

export type WikiEntry = {
  id: number;
  category_id: number;
  title: string;
  slug: string;
  image_url: string | null;
  excerpt: string | null;
  content?: string;
  is_published: boolean;
  is_unlocked: boolean;
  visibility_state: WikiVisibilityState;
  tags: string[];
  linked_entry_ids: number[];
  linked_entries: WikiLinkedEntry[];
  created_at: string;
};

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  is_admin: boolean;
  role: "gm" | "player";
};
