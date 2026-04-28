"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import MaterialSymbol from "@/components/MaterialSymbol";
import { supabase } from "@/lib/supabase";

const MAX_MESSAGE_LENGTH = 1000;

function getInitials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatMessageTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getScrimTitle(scrim) {
  const postingTeam = scrim?.posting_team?.name || "Posting Team";
  const matchedTeam = scrim?.matched_team?.name || "Matched Team";
  return `${postingTeam} vs ${matchedTeam}`;
}

export default function ScrimChatPage() {
  const { id } = useParams();
  const router = useRouter();
  const bottomRef = useRef(null);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [teamIds, setTeamIds] = useState([]);
  const [scrim, setScrim] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [accessMessage, setAccessMessage] = useState("");

  const fetchMessages = useCallback(async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("scrim_messages")
      .select("id, scrim_request_id, sender_user_id, sender_display_name, sender_team_id, body, created_at")
      .eq("scrim_request_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to load scrim messages", error);
      setErrorMessage("We could not load chat messages. Make sure the chat SQL has been run in Supabase.");
      return;
    }

    setMessages(data || []);
  }, [id]);

  useEffect(() => {
    async function fetchChat() {
      setIsLoading(true);
      setErrorMessage("");
      setAccessMessage("");

      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("users")
        .select("id, org_id, display_name")
        .eq("id", userData.user.id)
        .single();

      if (profileError) {
        console.error("Failed to load profile for scrim chat", profileError);
        setErrorMessage("We could not load your profile. Please try again.");
        setIsLoading(false);
        return;
      }

      if (!profileData?.org_id) {
        setAccessMessage("Create an organization before using scrim chat.");
        setIsLoading(false);
        return;
      }

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .eq("org_id", profileData.org_id);

      if (teamsError) {
        console.error("Failed to load teams for scrim chat", teamsError);
        setErrorMessage("We could not load your teams. Please try again.");
        setIsLoading(false);
        return;
      }

      const myTeamIds = (teams || []).map((team) => team.id);

      const { data: scrimData, error: scrimError } = await supabase
        .from("scrim_requests")
        .select(
          `
          id,
          posting_team_id,
          matched_team_id,
          game_title,
          scheduled_at,
          status,
          posting_team:teams!scrim_requests_posting_team_id_fkey (
            id,
            name,
            game_title,
            organization:organizations!teams_org_id_fkey (
              id,
              name
            )
          ),
          matched_team:teams!scrim_requests_matched_team_id_fkey (
            id,
            name,
            game_title,
            organization:organizations!teams_org_id_fkey (
              id,
              name
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (scrimError) {
        console.error("Failed to load scrim for chat", scrimError);
        setErrorMessage(scrimError.code === "PGRST116" ? "Scrim not found." : "We could not load this scrim.");
        setIsLoading(false);
        return;
      }

      const isParticipant = myTeamIds.includes(scrimData.posting_team_id) || myTeamIds.includes(scrimData.matched_team_id);

      setAuthUser(userData.user);
      setProfile(profileData);
      setTeamIds(myTeamIds);
      setScrim(scrimData);

      if (scrimData.status !== "confirmed") {
        setAccessMessage("Chat opens after the scrim is confirmed.");
        setIsLoading(false);
        return;
      }

      if (!isParticipant) {
        setAccessMessage("You do not have access to this chat.");
        setIsLoading(false);
        return;
      }

      await fetchMessages();
      setIsLoading(false);
    }

    fetchChat();
  }, [fetchMessages, id, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const body = input.trim();

    if (!body || !authUser || !scrim || scrim.status !== "confirmed") return;

    setIsSending(true);
    setErrorMessage("");

    const senderTeamId = teamIds.includes(scrim.posting_team_id)
      ? scrim.posting_team_id
      : scrim.matched_team_id;

    try {
      const { error } = await supabase
        .from("scrim_messages")
        .insert({
          scrim_request_id: scrim.id,
          sender_user_id: authUser.id,
          sender_display_name: profile?.display_name || authUser.email || "Teammate",
          sender_team_id: senderTeamId,
          body,
        });

      if (error) {
        console.error("Failed to send scrim message", error);
        setErrorMessage(error.message || "We could not send that message.");
        return;
      }

      setInput("");
      await fetchMessages();
    } catch (sendError) {
      console.error("Failed to send scrim message", sendError);
      setErrorMessage(sendError.message || "Something went wrong while sending that message.");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  const title = getScrimTitle(scrim);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-md top-0 sticky z-50 shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] border-b border-slate-200/50 flex justify-between items-center w-full px-5 h-14">
        <Link
          href={id ? `/scrims/${id}` : "/requests"}
          className="text-primary hover:bg-surface-container transition-colors active:scale-95 p-2 -ml-2 rounded-full flex items-center justify-center"
        >
          <MaterialSymbol>arrow_back_ios_new</MaterialSymbol>
        </Link>
        <div className="flex flex-col items-center justify-center flex-1 min-w-0">
          <h1 className="text-lg font-black tracking-tighter text-on-surface leading-tight">Scrim Chat</h1>
          <span className="font-label-small text-label-small text-on-surface-variant truncate max-w-[260px]">
            {title}
          </span>
        </div>
        <Link
          href={id ? `/scrims/${id}` : "/requests"}
          className="text-primary hover:bg-surface-container transition-colors active:scale-95 p-2 -mr-2 rounded-full flex items-center justify-center"
        >
          <MaterialSymbol>info</MaterialSymbol>
        </Link>
      </header>

      <main className="flex-1 overflow-y-auto px-margin-mobile pt-lg pb-36 flex flex-col gap-lg max-w-[1200px] w-full mx-auto">
        {isLoading ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-md font-body-sub text-body-sub text-on-surface-variant">
            Loading chat...
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl bg-error-container px-md py-sm font-body-sub text-body-sub text-on-error-container">
            {errorMessage}
          </div>
        ) : accessMessage ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-lg text-center">
            <MaterialSymbol className="mx-auto mb-sm block text-[40px] text-outline">lock</MaterialSymbol>
            <h2 className="font-headline-3 text-headline-3 text-on-surface">{accessMessage}</h2>
            <Link className="mt-md inline-flex rounded-lg bg-primary px-md py-sm font-label-bold text-label-bold text-on-primary" href="/requests">
              Back to Requests
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center w-full mt-sm">
              <div className="bg-surface-container-highest text-on-surface-variant font-label-small text-label-small px-3 py-1 rounded-full">
                Confirmed Scrim
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-lg text-center">
                <MaterialSymbol className="mx-auto mb-sm block text-[36px] text-outline">chat_bubble</MaterialSymbol>
                <h2 className="font-headline-3 text-headline-3 text-on-surface">No messages yet.</h2>
                <p className="mt-xs font-body-sub text-body-sub text-on-surface-variant">
                  Coordinate lobby details here.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.sender_user_id === authUser?.id;
                const sender = isUser ? "You" : message.sender_display_name || "Opponent";

                return (
                  <div key={message.id} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`flex flex-col gap-xs max-w-[80%] md:max-w-[60%] ${isUser ? "items-end" : ""}`}>
                      <span className={`font-label-small text-label-small text-on-surface-variant ${isUser ? "mr-2" : "ml-2"}`}>
                        {sender}
                      </span>
                      <div
                        className={`whitespace-pre-wrap break-words font-body-main text-body-main px-md py-sm ${
                          isUser
                            ? "bg-primary text-on-primary rounded-2xl rounded-tr-sm shadow-[0_2px_10px_rgba(0,112,235,0.15)]"
                            : "bg-surface-container text-on-surface rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                        }`}
                      >
                        {message.body}
                      </div>
                      <span className={`font-label-small text-[10px] text-outline ${isUser ? "mr-2" : "ml-2"}`}>
                        {formatMessageTime(message.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </>
        )}
      </main>

      {!isLoading && !errorMessage && !accessMessage && (
        <div className="fixed bottom-0 w-full bg-surface-container-lowest/95 backdrop-blur-xl border-t border-surface-container-highest z-40 shadow-[0_-4px_20px_0_rgba(0,0,0,0.03)]" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 16px), 16px)" }}>
          <div className="max-w-[1200px] mx-auto px-margin-mobile py-sm flex items-end gap-sm">
            <div className="flex-1">
              <textarea
                className="max-h-32 min-h-[48px] w-full resize-none rounded-2xl border-none bg-surface-container px-4 py-3 font-body-main text-body-main text-on-surface placeholder:text-outline outline-none transition-all focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                value={input}
              />
              <div className="mt-1 text-right font-label-small text-[10px] text-outline">
                {input.length}/{MAX_MESSAGE_LENGTH}
              </div>
            </div>
            <button
              className="mb-5 h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-all hover:bg-surface-tint active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSending || input.trim().length === 0}
              onClick={sendMessage}
              type="button"
            >
              <MaterialSymbol className="text-[20px]" fill>{isSending ? "hourglass_top" : "send"}</MaterialSymbol>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
