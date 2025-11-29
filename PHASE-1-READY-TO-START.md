# Phase 1: Ready to Start! 🚀
**Date:** 2025-11-27  
**Status:** ✅ All Prerequisites Met

---

## ✅ Verification Complete

### Backend Lambdas - WORKING ✅
- ✅ `shelcaster-create-show` - Creates shows in DynamoDB
- ✅ `shelcaster-create-stage` - Creates IVS Stages + tokens
- ✅ `shelcaster-create-ivs-channel` - Creates IVS Channels
- ✅ `shelcaster-create-caller-token` - Generates caller tokens
- ✅ All tracklist/show management Lambdas deployed

### API Gateway Routes - EXIST ✅
- ✅ `POST /shows` → shelcaster-create-show
- ✅ `GET /shows/{showId}` → shelcaster-get-show
- ✅ `GET /producers/{producerId}/shows` → shelcaster-get-producer-shows
- ✅ `POST /shows/{showId}/stage` → shelcaster-create-stage
- ✅ `POST /shows/{showId}/ivs-channel` → shelcaster-create-ivs-channel
- ✅ `POST /shows/{showId}/caller-token` → shelcaster-create-caller-token
- ✅ `POST /shows/{showId}/start` → shelcaster-start-broadcast
- ✅ `POST /shows/{showId}/stop` → shelcaster-stop-broadcast

**API Gateway ID:** `td0dn99gi2`  
**Base URL:** `https://td0dn99gi2.execute-api.us-east-1.amazonaws.com`

---

## 🎯 Phase 1 Tasks (This Week)

### Goal: Connect show-creator-studio UI to Backend

**Estimated Time:** 2-3 days

### Task 1: Create API Client (30 minutes)

**File:** `show-creator-studio/src/services/api.ts`

```typescript
const API_BASE_URL = 'https://td0dn99gi2.execute-api.us-east-1.amazonaws.com';

export const apiClient = {
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  },
  
  get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  },
  
  post(endpoint: string, data: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
```

---

### Task 2: Create Show Service (1 hour)

**File:** `show-creator-studio/src/services/showService.ts`

```typescript
import { apiClient } from './api';

export interface Show {
  showId: string;
  title: string;
  description: string;
  producerId: string;
  scheduledStartTime: string;
  tracklistId?: string;
  status: string;
  stageArn?: string;
  ivsChannelArn?: string;
}

export const showService = {
  async createShow(data: {
    title: string;
    description: string;
    producerId: string;
    scheduledStartTime: string;
    tracklistId?: string;
  }): Promise<Show> {
    const response = await apiClient.post('/shows', data);
    return response.show;
  },

  async getShow(showId: string): Promise<Show> {
    const response = await apiClient.get(`/shows/${showId}`);
    return response.show;
  },

  async getProducerShows(producerId: string): Promise<Show[]> {
    const response = await apiClient.get(`/producers/${producerId}/shows`);
    return response.shows;
  },
};
```

---

### Task 3: Create Stage Service (1 hour)

**File:** `show-creator-studio/src/services/stageService.ts`

```typescript
import { apiClient } from './api';

export interface StageTokens {
  stageArn: string;
  hostToken: string;
  callerToken: string;
  participantId: string;
}

export interface ChannelInfo {
  channelArn: string;
  streamKey: string;
  ingestEndpoint: string;
  playbackUrl: string;
}

export const stageService = {
  async createStage(showId: string, userId: string): Promise<StageTokens> {
    return apiClient.post(`/shows/${showId}/stage`, { userId });
  },

  async createChannel(showId: string, userId: string): Promise<ChannelInfo> {
    return apiClient.post(`/shows/${showId}/channel`, { userId });
  },

  async createCallerToken(showId: string, callerName: string): Promise<{
    token: string;
    participantId: string;
    stageArn: string;
  }> {
    return apiClient.post(`/shows/${showId}/caller-token`, { callerName });
  },
};
```

---

### Task 4: Update ShowManager Component (2 hours)

**File:** `show-creator-studio/src/components/studio/ShowManager.tsx`

**Changes:**
1. Replace mock data with real API calls
2. Add loading states
3. Add error handling
4. Test show creation flow

**Example:**
```typescript
import { showService } from '@/services/showService';
import { useState } from 'react';

const handleCreateShow = async (name: string, tracklistId: string) => {
  setLoading(true);
  try {
    const show = await showService.createShow({
      title: name,
      description: '',
      producerId: currentUser.id, // from auth context
      scheduledStartTime: new Date().toISOString(),
      tracklistId,
    });
    
    setCurrentShow(show);
    toast.success('Show created successfully!');
  } catch (error) {
    toast.error('Failed to create show');
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

---

### Task 5: Update StudioControls Component (2 hours)

**File:** `show-creator-studio/src/components/studio/StudioControls.tsx`

**Changes:**
1. "Go Live" button creates Stage + Channel
2. Display connection status
3. Store tokens in state
4. Show loading states

**Example:**
```typescript
import { stageService } from '@/services/stageService';

const handleGoLive = async () => {
  if (!currentShow) return;
  
  setLoading(true);
  try {
    // Create Stage
    const stageTokens = await stageService.createStage(
      currentShow.showId,
      currentUser.id
    );
    
    // Create Channel
    const channelInfo = await stageService.createChannel(
      currentShow.showId,
      currentUser.id
    );
    
    setStageTokens(stageTokens);
    setChannelInfo(channelInfo);
    setIsLive(true);
    
    toast.success('Stage and Channel created!');
  } catch (error) {
    toast.error('Failed to go live');
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

---

## 📝 Testing Checklist

### Test 1: Show Creation
- [ ] Open show-creator-studio
- [ ] Click "Create Show"
- [ ] Enter show name
- [ ] Select tracklist
- [ ] Click "Create"
- [ ] Verify show appears in list
- [ ] Check DynamoDB for show record

### Test 2: Go Live
- [ ] Select a show
- [ ] Click "Go Live"
- [ ] Verify Stage ARN displayed
- [ ] Verify Channel ARN displayed
- [ ] Check AWS IVS console for Stage
- [ ] Check AWS IVS console for Channel

---

## 🚀 Ready to Start!

**Everything is in place:**
- ✅ Backend Lambdas working
- ✅ API Gateway routes exist
- ✅ show-creator-studio UI ready
- ✅ Clear implementation plan

**Next Command:**
```bash
cd ../show-creator-studio
npm install
npm run dev
```

Then start implementing the API client and services!

**Estimated completion:** 2-3 days for Phase 1

After Phase 1 is complete, we'll move to Phase 2 (WebRTC) and eventually Phase 5 (Composition Service).

---

## 📞 Need Help?

If you encounter any issues:
1. Check Lambda logs in CloudWatch
2. Check browser console for errors
3. Verify API Gateway CORS settings
4. Test Lambdas directly with test payloads

**Let's build this! 🎉**

