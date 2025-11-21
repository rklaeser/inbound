'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, Check } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SearchableAuthorFilterProps {
  authors: string[];
  selectedAuthor: string;
  onAuthorChange: (author: string) => void;
}

export function SearchableAuthorFilter({
  authors,
  selectedAuthor,
  onAuthorChange,
}: SearchableAuthorFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter authors based on search query
  const filteredAuthors = useMemo(() => {
    if (!searchQuery) return authors;
    const query = searchQuery.toLowerCase();
    return authors.filter(author =>
      author.toLowerCase().includes(query)
    );
  }, [authors, searchQuery]);

  const handleSelect = (author: string) => {
    onAuthorChange(author);
    setOpen(false);
    setSearchQuery('');
  };

  const displayText = selectedAuthor === "all"
    ? "All Authors"
    : selectedAuthor;

  // Handle input value - show search query when open, selected author when closed
  const inputValue = open ? searchQuery : displayText;

  // When popover opens, clear search and focus input
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="All Authors..."
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 py-1 text-sm shadow-sm transition-colors",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
          {searchQuery && open && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] p-0 bg-[#1a1a1a] border-[rgba(255,255,255,0.15)]"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Authors list */}
        <div className="max-h-[300px] overflow-y-auto p-1.5">
          {/* "All Authors" option */}
          <button
            onClick={() => handleSelect("all")}
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-[#2a2a2a]",
              selectedAuthor === "all" && "bg-[#2a2a2a]"
            )}
          >
            <div className="flex items-center gap-2 flex-1">
              <div className="h-6 w-6 rounded-full bg-[#333] flex items-center justify-center text-xs">
                All
              </div>
              <span>All Authors</span>
            </div>
            {selectedAuthor === "all" && (
              <Check className="h-4 w-4 opacity-100" />
            )}
          </button>

          {/* Filtered authors */}
          {filteredAuthors.map((author) => (
            <button
              key={author}
              onClick={() => handleSelect(author)}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-[#2a2a2a]",
                selectedAuthor === author && "bg-[#2a2a2a]"
              )}
            >
              <div className="flex items-center gap-2 flex-1">
                {/* Avatar with first letter */}
                <div className="h-6 w-6 rounded-full bg-[#333] flex items-center justify-center text-xs font-medium">
                  {author.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{author}</span>
              </div>
              {selectedAuthor === author && (
                <Check className="h-4 w-4 opacity-100" />
              )}
            </button>
          ))}

          {/* No results */}
          {filteredAuthors.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No authors found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
