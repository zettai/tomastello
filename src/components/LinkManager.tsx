"use client";

import { useEffect, useState } from "react";
import { LinkMetadata } from "@/types/link";
import { useAdminToast } from "@/components/AdminToast";
import { readApiError } from "@/lib/readApiError";
import { loadSiteForSave, putSiteWithEtags } from "@/lib/siteSave";

interface LinkManagerProps {
  readonly refreshTrigger: number;
}

export function LinkManager({ refreshTrigger }: LinkManagerProps) {
  const { showSuccess, showError } = useAdminToast();
  const [links, setLinks] = useState<LinkMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLink, setEditingLink] = useState<LinkMetadata | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    text: "",
    href: "",
    description: "",
  });

  // Fetch links
  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const response = await fetch("/api/links");
        const result = await response.json();
        if (result.success && result.links) {
          setLinks(result.links);
        }
      } catch (error) {
        console.error("Failed to fetch links:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLinks();
  }, [refreshTrigger]);

  // Create link
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.text || !formData.href) {
      showError("Text and URL are required");
      return;
    }

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setLinks([...links, result.link]);
        setFormData({ text: "", href: "", description: "" });
        setIsCreating(false);
        showSuccess("Link created");
      } else {
        showError(result.error || "Failed to create link");
      }
    } catch (error) {
      console.error("Create error:", error);
      showError("Failed to create link");
    }
  };

  // Update link
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingLink) return;

    if (!formData.text || !formData.href) {
      showError("Text and URL are required");
      return;
    }

    try {
      const response = await fetch(`/api/links/${editingLink.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setLinks(links.map((l) => (l.id === editingLink.id ? result.link : l)));
        setEditingLink(null);
        setFormData({ text: "", href: "", description: "" });
        showSuccess("Link updated");
      } else {
        showError(result.error || "Failed to update link");
      }
    } catch (error) {
      console.error("Update error:", error);
      showError("Failed to update link");
    }
  };

  // Delete link
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this link?")) return;

    try {
      const response = await fetch(`/api/links?id=${id}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (result.success) {
        setLinks(links.filter((l) => l.id !== id));
      } else {
        showError(result.error || "Failed to delete link");
      }
    } catch (error) {
      console.error("Delete error:", error);
      showError("Failed to delete link");
    }
  };

  // Reorder links
  const moveLink = (index: number, direction: "up" | "down") => {
    const newLinks = [...links];
    const newIndex = direction === "up" ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= newLinks.length) return;

    [newLinks[index], newLinks[newIndex]] = [
      newLinks[newIndex],
      newLinks[index],
    ];
    setLinks(newLinks);
  };

  // Save order
  const handleSaveOrder = async () => {
    try {
      const { data, etags } = await loadSiteForSave();
      const response = await putSiteWithEtags({ ...data, links }, etags);
      if (!response.ok) {
        showError(await readApiError(response, "Failed to save order"));
        return;
      }
      showSuccess("Link order saved");
    } catch (error) {
      console.error("Save order error:", error);
      showError("Failed to save order");
    }
  };

  // Start editing
  const startEditing = (link: LinkMetadata) => {
    setEditingLink(link);
    setFormData({
      text: link.text,
      href: link.href,
      description: link.description || "",
    });
  };

  // Cancel editing/creating
  const handleCancel = () => {
    setEditingLink(null);
    setIsCreating(false);
    setFormData({ text: "", href: "", description: "" });
  };

  if (loading) {
    return <div className="admin-text">Loading links...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Add Link Button */}
      {!isCreating && !editingLink && (
        <button
          onClick={() => setIsCreating(true)}
          className="admin-button px-4 py-2"
        >
          + ADD LINK
        </button>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingLink) && (
        <div className="admin-window p-4">
          <h3 className="admin-text font-bold mb-3">
            {isCreating ? "Add New Link" : "Edit Link"}
          </h3>
          <form
            onSubmit={isCreating ? handleCreate : handleUpdate}
            className="space-y-3"
          >
            <div>
              <label
                htmlFor="link-text"
                className="block admin-text text-sm mb-1"
              >
                Link Text *
              </label>
              <input
                type="text"
                id="link-text"
                placeholder="Enter link text"
                value={formData.text}
                onChange={(e) =>
                  setFormData({ ...formData, text: e.target.value })
                }
                className="admin-input w-full"
                required
              />
            </div>
            <div>
              <label
                htmlFor="link-href"
                className="block admin-text text-sm mb-1"
              >
                URL *
              </label>
              <input
                id="link-href"
                type="url"
                placeholder="https://example.com"
                value={formData.href}
                onChange={(e) =>
                  setFormData({ ...formData, href: e.target.value })
                }
                className="admin-input w-full"
                required
              />
            </div>
            <div>
              <label
                htmlFor="link-description"
                className="block admin-text text-sm mb-1"
              >
                Description (optional)
              </label>
              <textarea
                id="link-description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="admin-input w-full"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="admin-button px-4 py-2">
                SAVE
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="admin-button px-4 py-2"
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Links List */}
      {links.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="admin-text font-bold">Links ({links.length})</h3>
            <button
              onClick={handleSaveOrder}
              className="admin-button px-3 py-1 text-sm"
            >
              SAVE ORDER
            </button>
          </div>

          {links.map((link, index) => (
            <div
              key={link.id}
              className="admin-window p-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="admin-text font-bold">{link.text}</div>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs admin-text-secondary underline break-all"
                >
                  {link.href}
                </a>
                {link.description && (
                  <p className="text-xs admin-text-secondary mt-1">
                    {link.description}
                  </p>
                )}
                <div className="text-xs admin-text-secondary mt-1 break-all">
                  Created by {link.createdBy}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => moveLink(index, "up")}
                  disabled={index === 0}
                  className="admin-button px-2 py-1 text-xs disabled:opacity-50"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveLink(index, "down")}
                  disabled={index === links.length - 1}
                  className="admin-button px-2 py-1 text-xs disabled:opacity-50"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => startEditing(link)}
                  className="admin-button px-2 py-1 text-xs"
                >
                  EDIT
                </button>
                <button
                  onClick={() => handleDelete(link.id)}
                  className="admin-button px-2 py-1 text-xs"
                >
                  DEL
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {links.length === 0 && !isCreating && (
        <div className="admin-text text-center py-8">
          No links yet. Click &quot;ADD LINK&quot; to create one.
        </div>
      )}
    </div>
  );
}
