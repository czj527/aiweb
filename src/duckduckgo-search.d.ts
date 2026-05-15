declare module 'duckduckgo-search' {
  export function search(query: string, options?: { count?: number }): Promise<Array<{
    title: string;
    description?: string;
    url?: string;
    source?: string;
    publishedDate?: string;
  }>>;
}
