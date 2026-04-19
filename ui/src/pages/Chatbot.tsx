import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { accessApi } from "../api/access";
import { buildMarkdownMentionOptions } from "../lib/company-members";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useToastActions } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatDateTime, relativeTime } from "../lib/utils";
import { resolveIssueActiveRun } from "../lib/issueActiveRun";
import { IssueChatThread, type IssueChatComposerHandle } from "../components/IssueChatThread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Download, ExternalLink, MessageSquare, Plus, Trash2 } from "lucide-react";
import type { Agent, Issue, IssueComment } from "@paperclipai/shared";
import type { IssueChatComment } from "../lib/issue-chat-messages";
import type { MentionOption } from "@/components/MarkdownEditor";

function defaultSessionTitle(): string {
  return `Chat — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function exportChatAsMarkdown(title: string, comments: IssueComment[]) {
  const lines = [`# ${title}\n`];
  for (const c of comments) {
    const role = c.authorAgentId ? "Agent" : "You";
    lines.push(`## ${role} — ${formatDateTime(c.createdAt)}\n\n${c.body}\n`);
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface NewChatDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (title: string, agentId: string) => Promise<void>;
  agents: Agent[];
}

function NewChatDialog({ open, onClose, onConfirm, agents }: NewChatDialogProps) {
  const [title, setTitle] = useState(defaultSessionTitle);
  const [agentId, setAgentId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultSessionTitle());
      setAgentId("");
    }
  }, [open]);

  async function handleConfirm() {
    if (!agentId) return;
    setLoading(true);
    try {
      await onConfirm(title.trim() || defaultSessionTitle(), agentId);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="chat-title">Session name</Label>
            <Input
              id="chat-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultSessionTitle()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="chat-agent">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="chat-agent">
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !agentId}>
            {loading ? "Creating..." : "Start Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ChatSessionProps {
  session: Issue;
  agentMap: Map<string, Agent>;
  companyId: string;
  onBack?: () => void;
}

function ChatSession({ session, agentMap, companyId, onBack }: ChatSessionProps) {
  const { openNewIssue } = useDialog();
  const queryClient = useQueryClient();
  const composerRef = useRef<IssueChatComposerHandle>(null);

  const { data: liveRuns = [] } = useQuery({
    queryKey: queryKeys.issues.liveRuns(session.id),
    queryFn: () => heartbeatsApi.liveRunsForIssue(session.id),
    refetchInterval: 3000,
  });

  const hasLiveRuns = liveRuns.length > 0;

  const { data: activeRun = null } = useQuery({
    queryKey: queryKeys.issues.activeRun(session.id),
    queryFn: () => heartbeatsApi.activeRunForIssue(session.id),
    enabled: session.status === "in_progress",
    refetchInterval: hasLiveRuns ? false : 3000,
  });

  const resolvedActiveRun = useMemo(
    () => resolveIssueActiveRun(session, activeRun),
    [session, activeRun],
  );

  const hasActivity = hasLiveRuns || !!resolvedActiveRun;

  const { data: linkedRuns = [] } = useQuery({
    queryKey: queryKeys.issues.runs(session.id),
    queryFn: () => activityApi.runsForIssue(session.id),
    refetchInterval: hasActivity ? 5000 : false,
  });

  const { data: comments = [] } = useQuery({
    queryKey: queryKeys.issues.comments(session.id),
    queryFn: () => issuesApi.listComments(session.id, { order: "asc", limit: 200 }),
    refetchInterval: hasLiveRuns ? 3000 : 5000,
  });

  const addComment = useMutation({
    mutationFn: (body: string) => issuesApi.addComment(session.id, body, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.comments(session.id) });
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: (file: File) => issuesApi.uploadAttachment(companyId, session.id, file),
  });

  const handleAdd = useCallback(
    async (body: string) => {
      // If the agent unassigned itself after a run, re-assign before commenting so the wakeup fires.
      if (!session.assigneeAgentId) {
        const lastAgentComment = [...comments].reverse().find((c) => c.authorAgentId);
        if (lastAgentComment?.authorAgentId) {
          await issuesApi.update(session.id, { assigneeAgentId: lastAgentComment.authorAgentId, assigneeUserId: null });
        }
      }
      await addComment.mutateAsync(body);
    },
    [addComment, session, comments],
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      const attachment = await uploadAttachment.mutateAsync(file);
      return attachment.contentPath;
    },
    [uploadAttachment],
  );

  const handleAttachImage = useCallback(
    async (file: File) => {
      await uploadAttachment.mutateAsync(file);
    },
    [uploadAttachment],
  );

  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects.list(companyId),
    queryFn: () => projectsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: companyMembers } = useQuery({
    queryKey: queryKeys.access.companyUserDirectory(companyId),
    queryFn: () => accessApi.listUserDirectory(companyId),
    enabled: !!companyId,
  });

  const mentionOptions = useMemo<MentionOption[]>(
    () => buildMarkdownMentionOptions({ agents: Array.from(agentMap.values()), projects, members: companyMembers?.users }),
    [agentMap, projects, companyMembers?.users],
  );

  const resolvedLinkedRuns = useMemo(
    () =>
      linkedRuns.map((r) => ({
        ...r,
        hasStoredOutput: (r.logBytes ?? 0) > 0,
      })),
    [linkedRuns],
  );

  function handleExportMd() {
    exportChatAsMarkdown(session.title, comments);
  }

  function handleExportTask() {
    openNewIssue({
      title: session.title,
      description: comments
        .slice(-8)
        .map((c) => `**${c.authorAgentId ? "Agent" : "You"}**: ${c.body}`)
        .join("\n\n"),
    });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden shrink-0"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h2 className="font-semibold text-sm truncate">{session.title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportMd}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export MD
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportTask}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Export as Task
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <IssueChatThread
          composerRef={composerRef}
          comments={comments as IssueChatComment[]}
          linkedRuns={resolvedLinkedRuns}
          liveRuns={[]}
          activeRun={null}
          companyId={companyId}
          issueStatus={session.status}
          agentMap={agentMap}
          draftKey={`chatbot-draft-${session.id}`}
          onAdd={handleAdd}
          imageUploadHandler={handleImageUpload}
          onAttachImage={handleAttachImage}
          mentions={mentionOptions}
          composerDisabledReason={hasLiveRuns ? "Agent is working..." : null}
          fixedHeight
        />
      </div>
    </div>
  );
}

export function Chatbot() {
  const { selectedCompanyId } = useCompany();
  const companyId = selectedCompanyId!;
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToastActions();

  const { data: sessions = [] } = useQuery({
    queryKey: [...queryKeys.issues.list(companyId), "chatbot"],
    queryFn: () => issuesApi.list(companyId, { originKind: "chatbot" }),
    refetchInterval: 10_000,
    enabled: !!companyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const agentMap = useMemo<Map<string, Agent>>(
    () => new Map(agents.map((a) => [a.id, a])),
    [agents],
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId],
  );

  const createSession = useMutation({
    mutationFn: ({ title, agentId }: { title: string; agentId: string }) =>
      issuesApi.create(companyId, {
        title,
        originKind: "chatbot",
        status: "backlog",
        assigneeAgentId: agentId,
      }),
    onSuccess: (issue) => {
      queryClient.setQueryData(
        [...queryKeys.issues.list(companyId), "chatbot"],
        (old: Issue[] | undefined) => [issue, ...(old ?? [])],
      );
      setSelectedSessionId(issue.id);
    },
  });

  const deleteSession = useMutation({
    mutationFn: (id: string) => issuesApi.remove(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData(
        [...queryKeys.issues.list(companyId), "chatbot"],
        (old: Issue[] | undefined) => (old ?? []).filter((s) => s.id !== id),
      );
      if (selectedSessionId === id) setSelectedSessionId(null);
      setConfirmDeleteId(null);
    },
    onError: (err) => {
      setConfirmDeleteId(null);
      pushToast({ title: "Failed to delete chat", body: String(err), tone: "error" });
    },
  });

  async function handleNewChat(title: string, agentId: string) {
    await createSession.mutateAsync({ title, agentId });
  }

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setConfirmDeleteId(id);
  }

  const showChatPanel = !!selectedSession;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Session list — always visible on md+, hidden on mobile when a session is selected */}
      <div
        className={cn(
          "flex flex-col border-r border-border shrink-0 w-full md:w-64",
          showChatPanel && "hidden md:flex",
        )}
      >
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-sm font-semibold">Chats</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setNewChatOpen(true)}
            title="New Chat"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center text-muted-foreground text-sm">
              <MessageSquare className="h-8 w-8 opacity-40" />
              <p>No chats yet</p>
              <Button variant="outline" size="sm" onClick={() => setNewChatOpen(true)}>
                Start a chat
              </Button>
            </div>
          ) : (
            sessions.map((session) => (
              <div key={session.id} className="group relative">
                {confirmDeleteId === session.id ? (
                  <div
                    className={cn(
                      "px-3 py-2.5 text-sm",
                      session.id === selectedSessionId && "bg-accent text-accent-foreground",
                    )}
                  >
                    <p className="font-medium truncate mb-1.5">{session.title}</p>
                    <p className="text-xs text-muted-foreground mb-2">Delete this chat?</p>
                    <div className="flex gap-1.5">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => deleteSession.mutate(session.id)}
                        disabled={deleteSession.isPending}
                      >
                        {deleteSession.isPending ? "Deleting..." : "Delete"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleteSession.isPending}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex items-center gap-1 hover:bg-accent/50 transition-colors cursor-pointer",
                      session.id === selectedSessionId && "bg-accent text-accent-foreground",
                    )}
                    onClick={() => setSelectedSessionId(session.id)}
                  >
                    <div className="flex-1 min-w-0 px-3 py-2.5 text-sm">
                      <div className="font-medium truncate">{session.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {relativeTime(session.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(e, session.id)}
                      className="shrink-0 mr-2 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat panel — full width on mobile, flex-1 on md+ */}
      <div
        className={cn(
          "min-w-0 h-full overflow-hidden",
          showChatPanel ? "flex flex-col flex-1" : "hidden md:flex md:flex-1",
        )}
      >
        {selectedSession ? (
          <ChatSession
            key={selectedSession.id}
            session={selectedSession}
            agentMap={agentMap}
            companyId={companyId}
            onBack={() => setSelectedSessionId(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select or create a chat session</p>
            <Button variant="outline" onClick={() => setNewChatOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
        )}
      </div>

      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onConfirm={handleNewChat}
        agents={agents}
      />
    </div>
  );
}
