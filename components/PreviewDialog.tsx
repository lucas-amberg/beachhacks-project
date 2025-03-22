"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import FilePreview from "./FilePreview";

type PreviewDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
    fileType: string;
};

export default function PreviewDialog({
    isOpen,
    onClose,
    fileUrl,
    fileName,
    fileType,
}: PreviewDialogProps) {
    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl w-[90vw]">
                <DialogHeader>
                    <DialogTitle>Previewing: {fileName}</DialogTitle>
                </DialogHeader>
                <FilePreview
                    url={fileUrl}
                    fileType={fileType}
                    fileName={fileName}
                    onClose={onClose}
                />
            </DialogContent>
        </Dialog>
    );
}
