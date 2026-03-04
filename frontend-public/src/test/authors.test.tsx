import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { I18nProvider } from "@/i18n";
import { authorProfilePath, resolveAuthorKey } from "@/lib/authors";
import PublicAuthorsPage from "@/pages/PublicAuthorsPage";

function renderAuthorsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={["/authors"]}>
          <Routes>
            <Route path="/authors" element={<PublicAuthorsPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("authors helpers", () => {
  it("resolves author keys with fallback rules", () => {
    expect(resolveAuthorKey({ author_key: "alice", author_username: "alice", is_anonymous: false })).toBe("alice");
    expect(resolveAuthorKey({ author_key: "", author_username: "bob", is_anonymous: false })).toBe("bob");
    expect(resolveAuthorKey({ author_key: "", author_username: "", is_anonymous: true })).toBe("anonymous");
  });

  it("builds encoded author profile paths", () => {
    expect(authorProfilePath("simple")).toBe("/authors/simple");
    expect(authorProfilePath("name with space")).toBe("/authors/name%20with%20space");
  });
});

describe("PublicAuthorsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders author cards from API data", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              key: "alice",
              display_name: "Alice Writer",
              username: "alice",
              profile_photo: null,
              works_count: 3,
              books_count: 1,
              stories_count: 1,
              poems_count: 1,
              is_anonymous: false,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    renderAuthorsPage();

    await waitFor(() => {
      expect(screen.getByText("Alice Writer")).toBeInTheDocument();
    });

    const authorLink = screen.getByRole("link", { name: /Alice Writer/i });
    expect(authorLink).toHaveAttribute("href", "/authors/alice");
  });
});
