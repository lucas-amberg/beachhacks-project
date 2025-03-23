"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function AssignSubjectsButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [needsSubjects, setNeedsSubjects] = useState<number | null>(null);
    const [percentComplete, setPercentComplete] = useState(100);
    const [totalCategories, setTotalCategories] = useState(0);
    const [isComplete, setIsComplete] = useState(true);
    const [showStatus, setShowStatus] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const MAX_RETRIES = 3;

    useEffect(() => {
        // Check if there are categories that need subjects
        checkCategoriesStatus();
    }, []);

    // Add retry logic if initial check fails
    useEffect(() => {
        if (error && retryCount < MAX_RETRIES) {
            // Exponential backoff: 2s, 4s, 8s
            const retryDelay = Math.pow(2, retryCount + 1) * 1000;
            console.log(`API check failed, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            
            const retryTimer = setTimeout(() => {
                setRetryCount(prev => prev + 1);
                setError(null);
                checkCategoriesStatus();
            }, retryDelay);
            
            return () => clearTimeout(retryTimer);
        }
    }, [error, retryCount]);

    const checkCategoriesStatus = async () => {
        try {
            // Add error handling and timeout for the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout
            
            const response = await fetch("/api/assign-subjects-to-categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            // Check for non-200 response first
            if (!response.ok) {
                console.error(`API returned status ${response.status}: ${response.statusText}`);
                // Don't try to parse non-OK responses as JSON
                throw new Error(`API returned status ${response.status}`);
            }

            // Check content type before parsing
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                console.error("API didn't return JSON:", contentType);
                throw new Error("API didn't return JSON data");
            }

            // Try to parse the response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error("Error parsing API response:", parseError);
                throw new Error("Failed to parse API response");
            }
            
            // If we have a structured error response, use it
            if (!data.success) {
                console.warn("API returned success: false", data);
                
                // Still update UI with any available data, but don't show the widget
                if (data.needSubjects !== undefined) {
                    setNeedsSubjects(data.needSubjects);
                }
                if (data.totalCategories !== undefined) {
                    setTotalCategories(data.totalCategories);
                }
                if (data.percentComplete !== undefined) {
                    setPercentComplete(data.percentComplete);
                }
                if (data.complete !== undefined) {
                    setIsComplete(data.complete);
                }
                
                setShowStatus(false);
                return;
            }
            
            // Process successful response
            setNeedsSubjects(data.needSubjects);
            setTotalCategories(data.totalCategories);
            setPercentComplete(data.percentComplete);
            setIsComplete(data.complete);
            
            // Only show the status if there are categories without subjects
            setShowStatus(data.needSubjects > 0);
        } catch (error: any) {
            console.error("Error checking categories status:", error?.message || error);
            
            // Don't show the error to users, just silently fail
            // This prevents showing errors on initial page load if the API isn't ready
            setShowStatus(false);
        }
    };

    const handleAssignSubjects = async () => {
        setIsLoading(true);
        setMessage(null);
        setError(null);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for longer operation
            
            const response = await fetch("/api/assign-subjects-to-categories", {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Failed to assign subjects: ${response.statusText}`);
            }

            // Check content type before parsing
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                console.error("API didn't return JSON:", contentType);
                throw new Error("API didn't return JSON data");
            }

            // Try to parse the response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error("Error parsing API response:", parseError);
                throw new Error("Failed to parse API response");
            }
            
            if (!data.success) {
                throw new Error(data.error || "Operation failed");
            }
            
            if (data.updated === 0) {
                setMessage("All categories already have subjects assigned");
            } else {
                if (data.failed > 0) {
                    setMessage(`Successfully assigned subjects to ${data.updated} categories. ${data.failed} categories failed.`);
                } else {
                    setMessage(`Successfully assigned subjects to ${data.updated} categories`);
                }
            }
            
            // Refresh the status after updating
            await checkCategoriesStatus();
        } catch (error: any) {
            console.error("Error assigning subjects:", error?.message || error);
            
            if (error?.name === 'AbortError') {
                setError("Operation timed out. The process may still be running in the background.");
            } else {
                setError(error?.message || "Failed to assign subjects to categories");
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!showStatus && !message && !error) {
        return null;
    }

    return (
        <div className="mb-8">
            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            
            {message && (
                <Alert className="mb-4 bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700">{message}</AlertDescription>
                </Alert>
            )}
            
            {showStatus && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-medium">Categories without subjects</h3>
                        <Badge variant="outline">
                            {needsSubjects} of {totalCategories} categories
                        </Badge>
                    </div>
                    
                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1">
                            <span>Subject assignment progress</span>
                            <span>{percentComplete}%</span>
                        </div>
                        <Progress value={percentComplete} className="h-2" />
                    </div>
                    
                    <Button 
                        onClick={handleAssignSubjects} 
                        disabled={isLoading || isComplete}
                    >
                        {isLoading 
                            ? "Assigning subjects..." 
                            : isComplete 
                                ? "All categories have subjects" 
                                : "Assign subjects to all categories"}
                    </Button>
                </div>
            )}
        </div>
    );
} 