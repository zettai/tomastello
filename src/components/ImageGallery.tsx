"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface ImageMetadata {
  id: string;
  fileName: string;
  originalName: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
  uploadedBy: string;
  tags?: string[];
  description?: string;
  alt?: string;
}

interface ImageGalleryProps {
  refreshTrigger?: number;
}

export default function ImageGallery({
  refreshTrigger,
}: Readonly<ImageGalleryProps>) {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageMetadata | null>(
    null
  );
  const [editingImage, setEditingImage] = useState<ImageMetadata | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    alt: "",
    tags: [] as string[],
  });

  const fetchImages = async () => {
    try {
      const response = await fetch("/api/images/metadata");
      const result = await response.json();

      if (result.success) {
        setImages(result.metadata);
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (fileName: string, imageId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/images/delete?key=${encodeURIComponent(fileName)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        setImages(images.filter((img) => img.id !== imageId));
        if (selectedImage?.id === imageId) {
          setSelectedImage(null);
        }
      } else {
        alert("Failed to delete image");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete image");
    }
  };

  const updateMetadata = async (
    id: string,
    updates: Partial<ImageMetadata>
  ) => {
    try {
      const response = await fetch(`/api/images/metadata/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, ...updates }),
      });

      const result = await response.json();

      if (result.success) {
        setImages(images.map((img) => (img.id === id ? result.metadata : img)));
        setEditingImage(null);
      } else {
        alert("Failed to update metadata");
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Failed to update metadata");
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingImage) {
      updateMetadata(editingImage.id, {
        description: editForm.description,
        alt: editForm.alt,
        tags: editForm.tags,
      });
    }
  };

  const startEditing = (image: ImageMetadata) => {
    setEditingImage(image);
    setEditForm({
      description: image.description || "",
      alt: image.alt || "",
      tags: image.tags || [],
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  useEffect(() => {
    fetchImages();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl text-gray-400 mb-4">🖼️</div>
        <p className="text-gray-900 dark:text-gray-200">
          No images uploaded yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Image Gallery ({images.length} images)
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div
            key={image.id}
            className="group relative bg-white dark:bg-black shadow-sm overflow-hidden hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-800"
          >
            <button
              className="aspect-square relative cursor-pointer w-full"
              onClick={() => setSelectedImage(image)}
              type="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSelectedImage(null);
                }
              }}
            >
              <Image
                src={image.url}
                alt={image.alt || image.originalName}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                quality={75}
                priority={index < 4}
                onError={() => {
                  console.error("Image failed to load:", image.url);
                }}
              />
            </button>

            <div className="p-3">
              <p className="text-sm text-gray-900 dark:text-gray-200 truncate font-medium">
                {image.originalName}
              </p>
              {image.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {image.description}
                </p>
              )}
              {image.tags && image.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {image.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white px-1 py-0.5 border border-gray-300 dark:border-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                  {image.tags.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{image.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-900 dark:text-gray-300">
                  {formatFileSize(image.size)}
                </span>
                <span className="text-xs text-gray-900 dark:text-gray-300">
                  {formatDate(image.uploadedAt)}
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                By: {image.uploadedBy}
              </div>
              <div className="flex justify-between items-center mt-3 gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(image.url)}
                  className="text-xs bg-black hover:bg-gray-900 text-white px-2 py-1 transition-colors border border-gray-800"
                >
                  Copy URL
                </button>
                <button
                  onClick={() => startEditing(image)}
                  className="text-xs bg-gray-900 hover:bg-black text-white px-2 py-1 transition-colors border border-gray-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteImage(image.fileName, image.id)}
                  className="text-xs bg-black hover:bg-gray-900 text-white px-2 py-1 transition-colors border border-gray-800"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <button
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
          type="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSelectedImage(null);
            }
          }}
        >
          <div className="relative max-w-4xl max-h-full bg-white dark:bg-black overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="relative">
              <Image
                src={selectedImage.url}
                alt={selectedImage.alt || selectedImage.originalName}
                width={800}
                height={600}
                className="max-w-full max-h-full object-contain"
                quality={85}
                priority
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedImage.originalName}
              </h3>
              {selectedImage.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  {selectedImage.description}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <strong>Size:</strong> {formatFileSize(selectedImage.size)}
                </div>
                <div>
                  <strong>Type:</strong> {selectedImage.type}
                </div>
                <div>
                  <strong>Uploaded:</strong>{" "}
                  {formatDate(selectedImage.uploadedAt)}
                </div>
                <div>
                  <strong>By:</strong> {selectedImage.uploadedBy}
                </div>
              </div>
              {selectedImage.tags && selectedImage.tags.length > 0 && (
                <div className="mt-4">
                  <strong className="text-sm">Tags:</strong>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedImage.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white px-2 py-1 border border-gray-300 dark:border-gray-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </button>
      )}

      {/* Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-black p-6 max-w-md w-full border border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Edit Image Metadata
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({ ...editForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Add a description..."
                />
              </div>
              <div>
                <label
                  htmlFor="alt"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Alt Text
                </label>
                <input
                  id="alt"
                  type="text"
                  value={editForm.alt}
                  onChange={(e) =>
                    setEditForm({ ...editForm, alt: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Alternative text for accessibility..."
                />
              </div>
              <div>
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Tags (comma-separated)
                </label>
                <input
                  id="tags"
                  type="text"
                  value={editForm.tags.join(", ")}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      tags: e.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="nature, landscape, photo..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  className="px-4 py-2 text-gray-900 dark:text-white hover:text-black dark:hover:text-gray-100 border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-black hover:bg-gray-900 text-white border border-gray-800"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
