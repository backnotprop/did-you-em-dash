/**
 * @license
 * @copyright Michael Ramos, backnotprop
 */
import React, { useState, useEffect, useCallback } from "react";
import type { ChangeEvent, FormEvent, CSSProperties } from "react";

// --- API LOGIC ---

/**
 * Regular expressions for em dash detection
 */
const LOOSE_EM_DASH_REGEX = /(--|––|——|–|—)/; // Lazy dashes and real em dashes
const STRICT_EM_DASH_REGEX = /—/; // Only true em dashes

/**
 * Defines the structure of a Hacker News item that we care about.
 */
interface HackerNewsItem {
  id: number;
  deleted?: boolean;
  type: "story" | "comment" | "job" | "poll" | "pollopt";
  title?: string;
  text?: string;
  time: number; // Unix timestamp in seconds
}

/**
 * Result structure containing the found item (if any)
 */
interface SearchResult {
  found: boolean;
  item?: HackerNewsItem;
  matchedText?: string;
}

/**
 * Defines the signature for the progress callback function.
 * The API client will call this function to update the UI on its state.
 */
export type ProgressCallback = (state: "retrieving" | "searching") => void;

/**
 * Searches a user's submissions for an em dash by processing items in
 * concurrent batches for performance. It reports its progress via a callback.
 *
 * @param username The case-sensitive Hacker News username.
 * @param onProgress A callback function to report progress updates to the caller.
 * @param includeStories Whether to search story titles in addition to comments.
 * @param strictMode Whether to use strict em dash matching (true em dash only).
 * @returns A promise that resolves to the search result
 */
export const searchUntilEmDash = async (
  username: string,
  onProgress: ProgressCallback,
  includeStories: boolean = false,
  strictMode: boolean = false
): Promise<SearchResult> => {
  const CONCURRENCY_LIMIT = 10;
  // Define the cutoff date. We only search for items *before* this timestamp.
  const TARGET_TIMESTAMP_S = new Date("2022-11-30T23:59:59Z").getTime() / 1000;

  try {
    onProgress("retrieving");
    const userResponse = await fetch(
      `https://hacker-news.firebaseio.com/v0/user/${username}.json`
    );

    if (!userResponse.ok) {
      throw new Error(`User '${username}' not found.`);
    }

    const userData = await userResponse.json();
    
    if (!userData) {
      throw new Error(`User data not found for '${username}'.`);
    }
    
    const submissionIds: number[] = userData.submitted || [];

    if (submissionIds.length === 0) {
      return { found: false };
    }

    // REVERSE the order to search oldest first
    submissionIds.reverse();

    onProgress("searching");
    let foundEmDash = false;
    let foundItem: HackerNewsItem | undefined;
    let matchedText: string | undefined;

    for (let i = 0; i < submissionIds.length; i += CONCURRENCY_LIMIT) {
      if (foundEmDash) break;

      const batchIds = submissionIds.slice(i, i + CONCURRENCY_LIMIT);

      const batchPromises = batchIds.map(async (id) => {
        if (foundEmDash) return;

        const itemResponse = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );
        if (!itemResponse.ok) return;

        const item: HackerNewsItem = await itemResponse.json();

        // Skip items that are deleted, invalid, OR created on/after the target date.
        if (!item || item.deleted || item.time >= TARGET_TIMESTAMP_S) {
          return;
        }

        // Filter by item type based on includeStories setting
        if (!includeStories && item.type !== "comment") {
          return;
        }
        if (includeStories && item.type !== "comment" && item.type !== "story") {
          return;
        }

        const textToSearch = item.text || item.title || "";
        const emDashRegex = strictMode ? STRICT_EM_DASH_REGEX : LOOSE_EM_DASH_REGEX;
        
        if (emDashRegex.test(textToSearch)) {
          if (!foundEmDash) {
            // Only store the first found item
            foundEmDash = true;
            foundItem = item;
            matchedText = textToSearch;
          }
        }
      });

      await Promise.all(batchPromises);
    }

    return {
      found: foundEmDash,
      item: foundItem,
      matchedText: matchedText,
    };
  } catch (error) {
    console.error("An unexpected error occurred during the search:", error);
    throw error;
  }
};

// --- REACT COMPONENT ---

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{2,15}$/; // Letters, digits, dashes, underscores, 2-15 chars

const themeColors = {
  background: "#f5f5f5",
  foreground: "#1a1a1a",
  card: "#ffffff",
  cardForeground: "#1a1a1a",
  primary: "#3498ff",
  primaryForeground: "#ffffff",
  accent: "#ffc400",
  accentForeground: "#1a1a1a",
  destructive: "#ff3737",
  destructiveForeground: "#ffffff",
  border: "#333333",
  input: "#ffffff",
  ring: "#cccccc",
  mutedForeground: "#737373",
  success: "#2ecc71",
  successForeground: "#ffffff",
};

const shadows = {
  sm: "2px 2px 0px 2px hsl(0 0% 0% / 1.00), 2px 1px 2px 1px hsl(0 0% 0% / 1.00)",
  md: "2px 2px 0px 2px hsl(0 0% 0% / 1.00), 2px 2px 4px 1px hsl(0 0% 0% / 1.00)",
};

const borderRadius = "0px";

type ProgressState =
  | "idle"
  | "retrieving"
  | "searching"
  | "found"
  | "failed"
  | "error";

const stepsData = [
  { id: "retrieving", label: "Retrieving public submission info" },
  { id: "searching", label: "On the hunt, searching through submissions" },
  {
    id: "result",
    successLabel: "Found something...",
    failureLabel: "Oh, oh no...",
  },
];

export default function App() {
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [foundItem, setFoundItem] = useState<HackerNewsItem | null>(null);
  const [matchedText, setMatchedText] = useState<string>("");

  const [progressState, setProgressState] = useState<ProgressState>("idle");
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings state
  const [includeStories, setIncludeStories] = useState(false);
  const [strictMode, setStrictMode] = useState(false);

  const performSearch = useCallback(async (searchUsername: string) => {
    const trimmedUsername = searchUsername.trim();

    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setUsernameError(
        "Invalid username. Must be 2-15 alphanumeric characters, underscores, or hyphens."
      );
      setProgressState("idle");
      setIsLoading(false);
      return;
    }

    setUsernameError("");
    setErrorMessage("");
    setIsLoading(true);
    setProgressState("retrieving"); // Initial state after submission
    setFoundItem(null);
    setMatchedText("");

    try {
      // Define the callback function that the API client will use to update our state
      const onProgressCallback: ProgressCallback = (newState) => {
        setProgressState(newState);
      };

      // Call the real API function
      const result = await searchUntilEmDash(
        trimmedUsername,
        onProgressCallback,
        includeStories,
        strictMode
      );

      if (result.found) {
        setProgressState("found");
        setFoundItem(result.item || null);
        setMatchedText(result.matchedText || "");
      } else {
        setProgressState("failed");
      }
    } catch (error: any) {
      console.error("Caught error in UI:", error);
      setErrorMessage(error.message || "An unknown error occurred.");
      setProgressState("error");
    } finally {
      setIsLoading(false); // Process finished
    }
  }, [includeStories, strictMode]);

  // Parse URL query parameters and auto-submit on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const usernameParam = urlParams.get('username');
    const strictParam = urlParams.get('strict');
    
    // Set strict mode if parameter is present and truthy
    if (strictParam === 'true' || strictParam === '1') {
      setStrictMode(true);
    }
    
    if (usernameParam && USERNAME_REGEX.test(usernameParam.trim())) {
      const trimmedUsername = usernameParam.trim();
      setUsername(trimmedUsername);
      
      // Auto-submit after a short delay to ensure the component is fully rendered
      setTimeout(() => {
        performSearch(trimmedUsername);
      }, 100);
    }
  }, [performSearch]);

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newUsername = event.target.value;
    setUsername(newUsername);
    setUsernameError("");
    setErrorMessage("");
    // Reset the entire UI if user types in the input after a run is complete.
    if (progressState !== "idle") {
      setProgressState("idle");
      setIsLoading(false);
      setFoundItem(null);
      setMatchedText("");
    }
  };

  const handleUsernameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await performSearch(username);
  };

  // Function to format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Function to create markup for HTML content
  const createMarkup = (htmlContent: string) => {
    return { __html: htmlContent };
  };

  const componentSpecificStyles = `
  * {
    box-sizing: border-box;
  }
  @keyframes slideInFromBottom {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .slide-in {
    animation: slideInFromBottom 0.5s ease-out forwards;
  }
  .loading-dots::after {
    content: '';
    display: inline-block;
    width: 20px;
    animation: loadingDots 1.5s infinite;
  }
  @keyframes loadingDots {
    0%, 20% { content: '.'; }
    40% { content: '..'; }
    60% { content: '...'; }
    80%, 100% { content: ''; }
  }
  #usernameInput::placeholder { color: ${themeColors.mutedForeground}; }
  #usernameInput:focus {
    outline: none;
    box-shadow: 0 0 0 1px ${themeColors.input}, 0 0 0 3px ${themeColors.ring};
  }
  .submit-button:hover:not(:disabled) { background-color: #2f88e6; }
  .submit-button:focus:not(:disabled) {
    outline: none;
    box-shadow: 0 0 0 2px ${themeColors.card}, 0 0 0 4px ${themeColors.ring};
  }
  .submit-button:disabled { opacity: 0.7; cursor: not-allowed; }
  .post-content {
    padding: 1rem;
    background-color: ${themeColors.background};
    border-radius: ${borderRadius};
    box-shadow: ${shadows.sm};
    max-width: 100%;
    overflow-wrap: break-word;
  }
  .post-content p {
    margin: 0.5rem 0;
  }
  .post-content a {
    color: ${themeColors.primary};
    text-decoration: underline;
  }
  .post-date {
    font-size: 0.875rem;
    color: ${themeColors.mutedForeground};
    margin-bottom: 0.5rem;
  }
`;

  // --- STYLES ---
  const pageStyle: CSSProperties = {
    minHeight: "100vh",
    backgroundColor: themeColors.background,
    color: themeColors.foreground,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    paddingTop: "1rem",
    padding: "1rem",
    fontFamily: "Inter, sans-serif",
    justifyContent: "space-between",
  };
  const contentWrapperStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
    width: "100%",
    maxWidth: "32rem",
  };
  const cardStyle: CSSProperties = {
    backgroundColor: themeColors.card,
    padding: "1rem",
    borderRadius: borderRadius,
    boxShadow: shadows.md,
    width: "100%",
  };
  const headingStyle: CSSProperties = {
    fontSize: "1.5rem",
    lineHeight: "2rem",
    fontWeight: "600",
    textAlign: "center",
    color: themeColors.cardForeground,
    marginBottom: "0.5rem",
    marginTop: "0",
  };
  const formGroupStyle: CSSProperties = { marginBottom: "0.5rem" };
  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    paddingTop: "0.375rem",
    paddingBottom: "0.375rem",
    paddingLeft: "0.75rem",
    paddingRight: "0.75rem",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: borderRadius,
    boxShadow: shadows.sm,
    backgroundColor: themeColors.input,
    color: themeColors.cardForeground,
    transition: "border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out",
    borderColor: usernameError ? themeColors.destructive : themeColors.border,
    opacity: isLoading ? 0.7 : 1,
  };
  const errorMessageStyle: CSSProperties = {
    fontSize: "0.875rem",
    padding: "0.5rem",
    borderRadius: borderRadius,
    backgroundColor: themeColors.destructive,
    color: themeColors.destructiveForeground,
    textAlign: "center",
  };
  const buttonStyle: CSSProperties = {
    width: "100%",
    paddingLeft: "1rem",
    paddingRight: "1rem",
    paddingTop: "0.375rem",
    paddingBottom: "0.375rem",
    backgroundColor: themeColors.primary,
    color: themeColors.primaryForeground,
    borderRadius: borderRadius,
    boxShadow: shadows.sm,
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease-in-out, opacity 0.2s ease-in-out",
  };
  const progressContainerStyle: CSSProperties = {
    ...cardStyle,
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  };
  const progressStepItemStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    minHeight: "1rem",
  };
  const iconStyle: CSSProperties = {
    fontSize: "1rem",
    width: "1.25rem",
    textAlign: "center",
    display: "inline-block",
  };
  const progressStepTextStyleBase: CSSProperties = {
    fontSize: "0.875rem",
    fontWeight: "500",
    color: themeColors.cardForeground,
    flexGrow: 1,
    margin: "0",
  };
  const resultImageStyle: CSSProperties = {
    maxWidth: "256px",
    width: "100%",
    height: "auto",
    objectFit: "contain",
    borderRadius: borderRadius,
    boxShadow: shadows.sm,
  };
  const resultTextStyle: CSSProperties = {
    marginTop: "1rem",
    marginBottom: "0.5rem",
    fontWeight: 600,
    fontSize: "1rem",
    textAlign: "center",
  };
  const resultCardStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "1.5rem",
    width: "100%",
  };

  return (
    <>
      <style>{componentSpecificStyles}</style>
      <div style={pageStyle}>
        <div style={contentWrapperStyle}>
          <div style={cardStyle}>
            <h1 style={headingStyle} className="main-heading">
              {strictMode ? "Did you actually em dash?" : "Did you em dash?"}
            </h1>
            <form onSubmit={handleUsernameSubmit}>
              <div style={formGroupStyle}>
                <div style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}>
                  <input
                    id="usernameInput"
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="Hacker News username"
                    style={{
                      ...inputStyle,
                      paddingRight: "6rem", // Make room for badges
                    }}
                    disabled={isLoading}
                  />
                  <div style={{
                    position: "absolute",
                    right: "0.5rem",
                    display: "flex",
                    gap: "0.25rem",
                    alignItems: "center",
                  }}>
                    <button
                      type="button"
                      onClick={() => setStrictMode(!strictMode)}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.75rem",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "500",
                        backgroundColor: strictMode ? themeColors.primary : themeColors.mutedForeground,
                        color: strictMode ? themeColors.primaryForeground : themeColors.background,
                        opacity: strictMode ? 1 : 0.6,
                        transition: "all 0.2s ease",
                      }}
                      disabled={isLoading}
                    >
                      strict
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncludeStories(!includeStories)}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "0.75rem",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: "500",
                        backgroundColor: includeStories ? themeColors.primary : themeColors.mutedForeground,
                        color: includeStories ? themeColors.primaryForeground : themeColors.background,
                        opacity: includeStories ? 1 : 0.6,
                        transition: "all 0.2s ease",
                      }}
                      disabled={isLoading}
                    >
                      +titles
                    </button>
                  </div>
                </div>
              </div>
              {usernameError && (
                <p style={errorMessageStyle}>{usernameError}</p>
              )}
              <button
                type="submit"
                style={buttonStyle}
                className="submit-button"
                disabled={!username.trim() || isLoading}
              >
                {isLoading ? "Searching..." : "Submit"}
              </button>
            </form>
          </div>

          {/* Progress Stepper - only appears after submit */}
          {progressState !== "idle" && (
            <div
              style={progressContainerStyle}
              aria-live="polite"
              role="status"
            >
              {stepsData.map((step) => {
                let iconChar = "";
                let currentText = step.label!;
                const currentTextStyle = {
                  ...progressStepTextStyleBase,
                  color: themeColors.mutedForeground,
                };
                let isVisible = true;

                if (
                  progressState === "retrieving" &&
                  step.id === "retrieving"
                ) {
                  iconChar = "";
                  currentText = step.label!;
                  currentTextStyle.color = themeColors.cardForeground;
                } else if (
                  progressState === "searching" &&
                  (step.id === "retrieving" || step.id === "searching")
                ) {
                  iconChar = step.id === "retrieving" ? "✓" : "";
                  currentText = step.label!;
                  currentTextStyle.color = themeColors.cardForeground;
                } else if (
                  progressState === "found" ||
                  progressState === "failed"
                ) {
                  if (step.id === "retrieving" || step.id === "searching") {
                    iconChar = "✓";
                    currentTextStyle.color = themeColors.cardForeground;
                  } else if (step.id === "result") {
                    iconChar = progressState === "found" ? "✓" : "✗";
                    currentText =
                      progressState === "found"
                        ? step.successLabel!
                        : step.failureLabel!;
                    currentTextStyle.color =
                      progressState === "found"
                        ? themeColors.success
                        : themeColors.destructive;
                    currentTextStyle.fontWeight = "600";
                  }
                } else if (progressState === "error" && step.id === "result") {
                  iconChar = "✗";
                  currentText = errorMessage;
                  currentTextStyle.color = themeColors.destructive;
                  currentTextStyle.fontWeight = "600";
                } else {
                  if (step.id === "result") isVisible = false; // Hide result row unless finished
                }

                if (!isVisible) return null;

                const isLoading = (progressState === "retrieving" && step.id === "retrieving") || 
                                 (progressState === "searching" && step.id === "searching");

                return (
                  <div key={step.id} style={progressStepItemStyle}>
                    <span role="img" style={iconStyle} className={isLoading ? "loading-dots" : ""}>
                      {iconChar}
                    </span>
                    <p style={currentTextStyle}>
                      {currentText}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Result Card - only appears on success or failure */}
          {(progressState === "found" || progressState === "failed") && (
            <div className="slide-in" style={resultCardStyle}>
              <img
                src={progressState === "found" ? "./gg.png" : "./tl.png"}
                alt={
                  progressState === "found"
                    ? "Success confirmation"
                    : "Failure confirmation"
                }
                style={resultImageStyle}
              />
              <p
                style={{
                  ...resultTextStyle,
                  color: themeColors.cardForeground,
                  fontWeight: "700",
                  fontSize: "1.125rem",
                  fontStyle: "italic",
                }}
              >
                {progressState === "found"
                  ? "I no longer fear the cost of truth"
                  : "Every lie we tell incurs a debt to truth"}
              </p>
              {progressState === "failed" && (
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: themeColors.mutedForeground,
                    marginTop: "0.5rem",
                    textAlign: "center",
                  }}
                >
                  (no content found with em dash)
                </p>
              )}

              {/* Display the found post content */}
              {progressState === "found" && foundItem && (
                <div className="post-content" style={{ marginTop: "0.75rem" }}>
                  <div className="post-date">{formatDate(foundItem.time)}</div>
                  {foundItem.title && (
                    <h3 style={{ marginBottom: "0.5rem" }}>
                      <a 
                        href={`https://news.ycombinator.com/item?id=${foundItem.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: themeColors.primary, textDecoration: "none" }}
                      >
                        {foundItem.title}
                      </a>
                    </h3>
                  )}
                  {foundItem.text ? (
                    <div>
                      <div
                        dangerouslySetInnerHTML={createMarkup(foundItem.text)}
                      />
                      <p style={{ marginTop: "0.75rem", fontSize: "0.875rem" }}>
                        <a 
                          href={`https://news.ycombinator.com/item?id=${foundItem.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: themeColors.primary }}
                        >
                          View on Hacker News →
                        </a>
                      </p>
                    </div>
                  ) : foundItem.title ? (
                    <p>
                      <a 
                        href={`https://news.ycombinator.com/item?id=${foundItem.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: themeColors.primary }}
                      >
                        View on Hacker News →
                      </a>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Spacer */}
        <div style={{ height: "3rem" }}></div>
        
        {/* Footer */}
        <footer style={{
          marginTop: "auto",
          paddingTop: "2rem",
          padding: "1rem",
          fontSize: "0.75rem",
          color: themeColors.mutedForeground,
          textAlign: "center",
          borderTop: `1px solid ${themeColors.border}`,
          width: "100%",
          maxWidth: "24rem",
        }}>
          <a 
            href="https://x.com/DidYouEmDash" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: themeColors.primary, textDecoration: "underline" }}
          >
            @DidYouEmDash
          </a>
          {" | "}
          <span>HN API by Firebase</span>
          {" | "}
          <span>© backnotprop</span>
        </footer>
      </div>
    </>
  );
}
