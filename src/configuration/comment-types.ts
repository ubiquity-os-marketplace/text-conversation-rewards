export enum CommentType {
  /**
   * Review related item
   */
  REVIEW = 0b1,
  /**
   * Issue related item
   */
  ISSUE = 0b10,
  /**
   * User assigned to the {@link CommentType.ISSUE} or {@link CommentType.REVIEW}
   */
  ASSIGNEE = 0b100,
  /**
   * The author of the {@link CommentType.ISSUE} or {@link CommentType.REVIEW}
   */
  ISSUER = 0b1000,
  /**
   * A user that is part of the organization or owner of the repo
   */
  COLLABORATOR = 0b10000,
  /**
   * A user that is NOT part of the organization nor owner of the repo
   */
  CONTRIBUTOR = 0b100000,
  /**
   * A user comment action on a {@link CommentType.ISSUE} or {@link CommentType.REVIEW}
   */
  COMMENTED = 0b1000000,
  /**
   * Pull request opening item
   */
  TASK = 0b10000000,
  /**
   * Issue opening item
   */
  SPECIFICATION = 0b100000000,
}
