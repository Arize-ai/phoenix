import { graphql } from "./github.ts";
import { isOrgMember } from "./membership.ts";
import { orgMemberFlag, verdict, verdictFields, type Entry } from "./triage.ts";
import type { ItemRow } from "./types.ts";

interface Actor {
  login: string;
  __typename: string;
}
interface RawReply {
  createdAt: string;
  url: string;
  bodyText: string;
  author: Actor | null;
}
interface ReplyConn {
  totalCount: number;
  nodes: RawReply[];
}
interface RawComment {
  createdAt: string;
  url: string;
  bodyText: string;
  author: Actor | null;
  replies: ReplyConn;
}
interface CommentConn {
  totalCount: number;
  nodes: RawComment[];
}
export interface RawDiscussion {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closed: boolean;
  author: Actor | null;
  bodyText: string;
  comments: CommentConn;
}

// `last:` grabs recent comments/replies, but long discussions can exceed these
// caps. We detect that and force a manual-review verdict instead of trusting a
// partial conversation.
const QUERY = `
query($owner:String!,$name:String!,$cursor:String){
  repository(owner:$owner,name:$name){
    discussions(first:20, after:$cursor, orderBy:{field:UPDATED_AT, direction:DESC}){
      pageInfo{ hasNextPage endCursor }
      nodes{
        number title url createdAt updatedAt closed
        author{ login __typename }
        bodyText
        comments(last:40){
          totalCount
          nodes{
            createdAt url bodyText author{ login __typename }
            replies(last:15){
              totalCount
              nodes{ createdAt url bodyText author{ login __typename } }
            }
          }
        }
      }
    }
  }
}`;

interface DiscussionsPage {
  repository: {
    discussions: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: RawDiscussion[];
    };
  } | null;
}

/**
 * Discussions updated on or after `since`. There's no server-side `since`
 * filter, so we page newest-first and stop once we pass the cutoff. Pass
 * `null` to fetch all open discussions regardless of age (baseline scan).
 */
export async function fetchDiscussions(
  repo: string,
  since: string | null
): Promise<RawDiscussion[]> {
  const [owner, name] = repo.split("/");
  const out: RawDiscussion[] = [];
  let cursor: string | null = null;
  for (;;) {
    const data: DiscussionsPage = await graphql<DiscussionsPage>(QUERY, {
      owner,
      name,
      cursor,
    });
    if (!data.repository) {
      throw new Error(`Repository ${repo} not found or not accessible.`);
    }
    const conn = data.repository.discussions;
    let stop = false;
    for (const d of conn.nodes) {
      if (since && d.updatedAt < since) {
        stop = true;
        break;
      }
      out.push(d);
    }
    if (stop || !conn.pageInfo.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return out;
}

function actorUser(a: Actor | null): { login: string; type: string } | null {
  return a ? { login: a.login, type: a.__typename } : null;
}

function hasIncompleteData(d: RawDiscussion): boolean {
  if (d.comments.totalCount > d.comments.nodes.length) return true;
  return d.comments.nodes.some(
    (comment) => comment.replies.totalCount > comment.replies.nodes.length
  );
}

export async function triageDiscussion(
  repo: string,
  d: RawDiscussion,
  team: Set<string>,
  syncedAt: string
): Promise<ItemRow> {
  const entries: Entry[] = [
    {
      kind: "body",
      login: d.author?.login ?? null,
      user: actorUser(d.author),
      created_at: d.createdAt,
      url: d.url,
      body: d.bodyText ?? "",
    },
  ];

  for (const c of d.comments.nodes) {
    entries.push({
      kind: "comment",
      login: c.author?.login ?? null,
      user: actorUser(c.author),
      created_at: c.createdAt,
      url: c.url,
      body: c.bodyText ?? "",
    });
    for (const r of c.replies.nodes) {
      entries.push({
        kind: "reply",
        login: r.author?.login ?? null,
        user: actorUser(r.author),
        created_at: r.createdAt,
        url: r.url,
        body: r.bodyText ?? "",
      });
    }
  }

  const v = verdict(entries, team);
  const orgMember = await orgMemberFlag(v, isOrgMember);
  const isIncomplete = hasIncompleteData(d);
  return {
    uid: `${repo}#d${d.number}`,
    repo,
    number: d.number,
    type: "discussion",
    title: d.title,
    state: d.closed ? "closed" : "open",
    html_url: d.url,
    author: d.author?.login ?? null,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    closed_at: null,
    comments_count: d.comments.totalCount,
    labels: "[]",
    assigned_to_me: 0, // discussions have no assignee/review; never in the personal queue
    review_requested_from_me: 0,
    ...verdictFields(v, orgMember, syncedAt),
    // A discussion longer than the fetched GraphQL slice can't be triaged from
    // a partial conversation, so force a manual-review verdict.
    needs_attention: v.needs || isIncomplete ? 1 : 0,
    reason: isIncomplete ? "Long discussion; review manually" : v.reason,
  };
}
