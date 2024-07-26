export enum CommentKind {
  /**
   * Pull-request related item
   */
  PULL = 0b1,
  /**
   * Issue related item
   */
  ISSUE = 0b10,
}

export enum CommentAssociation {
  /**
   * User assigned to the {@link CommentKind.ISSUE} or {@link CommentKind.PULL}
   */
  ASSIGNEE = 0b100,
  /**
   * The author of the {@link CommentKind.ISSUE} or {@link CommentKind.PULL}
   */
  AUTHOR = 0b1000,
  /**
   * A user that is part of the organization or owner of the repo
   */
  COLLABORATOR = 0b10000,
  /**
   * A user that is NOT part of the organization nor owner of the repo
   */
  CONTRIBUTOR = 0b100000,
  /**
   * {@link CommentKind.ISSUE} or {@link CommentKind.PULL} opening item
   */
  SPECIFICATION = 0b10000000,
}

export const commentEnum = { ...CommentAssociation, ...CommentKind };

export type CommentType = `${keyof typeof CommentKind}_${keyof typeof CommentAssociation}`;
