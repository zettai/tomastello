export interface LinkMetadata {
  id: string;              // Unique identifier (timestamp-based)
  text: string;            // Display text (mandatory)
  href: string;            // URL (mandatory)
  description?: string;    // Optional description
  createdAt: string;       // ISO timestamp
  createdBy: string;       // User email who created it
}
