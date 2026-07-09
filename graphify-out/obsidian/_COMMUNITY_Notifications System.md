---
type: community
cohesion: 0.10
members: 37
---

# Notifications System

**Cohesion:** 0.10 - loosely connected
**Members:** 37 nodes

## Members
- [[CreateNotificationInput]] - code - lib/domains/notification/types.ts
- [[DELETE()]] - code - app/api/notifications/unsubscribe/route.ts
- [[GET()]] - code - app/api/notifications/stream/route.ts
- [[NotificationEntity]] - code - lib/domains/notification/types.ts
- [[NotificationPageState]] - code - lib/domains/notification/types.ts
- [[NotificationPayload]] - code - lib/domains/notification/types.ts
- [[NotificationViewModel]] - code - lib/domains/notification/types.ts
- [[POST()]] - code - app/api/notifications/subscribe/route.ts
- [[SavePushSubscriptionInput]] - code - lib/domains/notification/types.ts
- [[SseWriter]] - code - lib/notification-broker.ts
- [[getBroker()]] - code - lib/domains/notification/service.ts
- [[getMyNotificationPageState()]] - code - app/actions/notifications.ts
- [[getMyNotifications()]] - code - app/actions/notifications.ts
- [[getMyUnreadCount()]] - code - app/actions/notifications.ts
- [[getWebPush()]] - code - lib/domains/notification/service.ts
- [[globalForBroker]] - code - lib/notification-broker.ts
- [[globalForWebPush]] - code - lib/web-push.ts
- [[index.ts_5]] - code - lib/domains/index.ts
- [[index.ts_8]] - code - lib/domains/notification/index.ts
- [[markAllNotificationsRead()]] - code - app/actions/notifications.ts
- [[markNotificationRead()]] - code - app/actions/notifications.ts
- [[notification-broker.ts]] - code - lib/notification-broker.ts
- [[notificationBroker]] - code - lib/notification-broker.ts
- [[notificationRepository]] - code - lib/domains/notification/repository.ts
- [[notificationService]] - code - lib/domains/notification/service.ts
- [[notifications.ts]] - code - app/actions/notifications.ts
- [[repository.ts_5]] - code - lib/domains/notification/repository.ts
- [[route.ts_1]] - code - app/api/notifications/stream/route.ts
- [[route.ts_2]] - code - app/api/notifications/subscribe/route.ts
- [[route.ts_3]] - code - app/api/notifications/unsubscribe/route.ts
- [[sendWebPush()]] - code - lib/web-push.ts
- [[service.ts_5]] - code - lib/domains/notification/service.ts
- [[toPayload()]] - code - lib/domains/notification/service.ts
- [[toViewModel()]] - code - lib/domains/notification/repository.ts
- [[types.ts_5]] - code - lib/domains/notification/types.ts
- [[use-notifications.ts]] - code - lib/hooks/use-notifications.ts
- [[web-push.ts]] - code - lib/web-push.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Notifications_System
SORT file.name ASC
```

## Connections to other communities
- 8 edges to [[_COMMUNITY_Action Log Domain]]
- 5 edges to [[_COMMUNITY_Monthly Request Collections]]
- 5 edges to [[_COMMUNITY_Profile Sync Admin]]
- 4 edges to [[_COMMUNITY_Off Site Work]]
- 3 edges to [[_COMMUNITY_Leader Verification]]
- 2 edges to [[_COMMUNITY_Navigation Notifications UI]]
- 1 edge to [[_COMMUNITY_Shared Form Controls]]
- 1 edge to [[_COMMUNITY_Department Domain]]
- 1 edge to [[_COMMUNITY_Expense Claim Documents]]
- 1 edge to [[_COMMUNITY_Allowance Workflow Actions]]
- 1 edge to [[_COMMUNITY_User Signatures]]

## Top bridge nodes
- [[index.ts_5]] - degree 9, connects to 7 communities
- [[notifications.ts]] - degree 18, connects to 6 communities
- [[service.ts_5]] - degree 17, connects to 3 communities
- [[repository.ts_5]] - degree 13, connects to 2 communities
- [[index.ts_8]] - degree 12, connects to 2 communities