import * as React from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"

interface ConfirmOptions {
    title: string
    description?: React.ReactNode
    confirmText?: string
    cancelText?: string
    destructive?: boolean
}

interface PromptOptions {
    title: string
    description?: React.ReactNode
    confirmText?: string
    cancelText?: string
    defaultValue?: string
    placeholder?: string
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions) => Promise<boolean>
    promptText: (options: PromptOptions) => Promise<string | null>
}

const ConfirmContext = React.createContext<ConfirmContextType | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [options, setOptions] = React.useState<ConfirmOptions | null>(null)
    const resolveRef = React.useRef<(value: boolean) => void>()

    const [isPromptOpen, setIsPromptOpen] = React.useState(false)
    const [promptOptions, setPromptOptions] = React.useState<PromptOptions | null>(null)
    const [promptValue, setPromptValue] = React.useState("")
    const promptResolveRef = React.useRef<(value: string | null) => void>()

    const confirm = React.useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setOptions(opts)
            setIsOpen(true)
            resolveRef.current = resolve
        })
    }, [])

    const handleClose = React.useCallback((value: boolean) => {
        setIsOpen(false)
        if (resolveRef.current) {
            resolveRef.current(value)
            resolveRef.current = undefined
        }
    }, [])

    const promptText = React.useCallback((opts: PromptOptions) => {
        return new Promise<string | null>((resolve) => {
            setPromptOptions(opts)
            setPromptValue(opts.defaultValue || "")
            setIsPromptOpen(true)
            promptResolveRef.current = resolve
        })
    }, [])

    const handlePromptClose = React.useCallback((submit: boolean) => {
        setIsPromptOpen(false)
        if (promptResolveRef.current) {
            promptResolveRef.current(submit ? promptValue : null)
            promptResolveRef.current = undefined
        }
    }, [promptValue])

    return (
        <ConfirmContext.Provider value={{ confirm, promptText }}>
            {children}

            {/* Confirm Dialog */}
            <AlertDialog open={isOpen} onOpenChange={(open) => {
                if (!open) handleClose(false)
            }}>
                <AlertDialogContent className="font-ui border-border/70 shadow-2xl rounded-2xl p-6 sm:max-w-md animate-in fade-in zoom-in-95 duration-200">
                    <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="font-display text-xl leading-tight">{options?.title}</AlertDialogTitle>
                        {options?.description && (
                            <AlertDialogDescription className="text-sm font-ui text-muted-foreground leading-relaxed">
                                {options.description}
                            </AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3 sm:gap-2">
                        <AlertDialogCancel
                            className="mt-0 h-11 sm:h-10 px-5 font-medium rounded-xl hover:bg-secondary/80 transition-colors"
                            onClick={(e) => { e.preventDefault(); handleClose(false); }}
                        >
                            {options?.cancelText || "Cancel"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className={`h-11 sm:h-10 px-5 font-medium rounded-xl transition-colors ${options?.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
                            onClick={(e) => { e.preventDefault(); handleClose(true); }}
                        >
                            {options?.confirmText || "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Prompt Dialog */}
            <AlertDialog open={isPromptOpen} onOpenChange={(open) => {
                if (!open) handlePromptClose(false)
            }}>
                <AlertDialogContent className="font-ui border-border/70 shadow-2xl rounded-2xl p-6 sm:max-w-md animate-in fade-in zoom-in-95 duration-200">
                    <AlertDialogHeader className="space-y-3">
                        <AlertDialogTitle className="font-display text-xl leading-tight">{promptOptions?.title}</AlertDialogTitle>
                        {promptOptions?.description && (
                            <AlertDialogDescription className="text-sm font-ui text-muted-foreground leading-relaxed">
                                {promptOptions.description}
                            </AlertDialogDescription>
                        )}
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Input
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            placeholder={promptOptions?.placeholder}
                            className="h-11 font-ui"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handlePromptClose(true);
                                }
                            }}
                        />
                    </div>
                    <AlertDialogFooter className="mt-2 gap-3 sm:gap-2">
                        <AlertDialogCancel
                            className="mt-0 h-11 sm:h-10 px-5 font-medium rounded-xl hover:bg-secondary/80 transition-colors"
                            onClick={(e) => { e.preventDefault(); handlePromptClose(false); }}
                        >
                            {promptOptions?.cancelText || "Cancel"}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="h-11 sm:h-10 px-5 font-medium rounded-xl transition-colors"
                            onClick={(e) => { e.preventDefault(); handlePromptClose(true); }}
                        >
                            {promptOptions?.confirmText || "Confirm"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </ConfirmContext.Provider>
    )
}

export function useConfirm() {
    const context = React.useContext(ConfirmContext)
    if (!context) {
        throw new Error("useConfirm must be used within ConfirmProvider")
    }
    return context
}
