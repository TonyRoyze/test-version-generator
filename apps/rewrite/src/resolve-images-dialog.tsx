import { Modal } from '@/components/modal'
import { Button } from '@/components/ui/button'
import { useRef, useState } from 'react'
import type {
  PendingImageOccurrence,
  PendingImageResolution,
} from './pending-images'
import { ResolveImages } from './resolve-images'
import {
  prefilledPictures,
  resolutionOf,
  type Resolutions,
  type ResolvingSource,
} from './resolved-pictures'

/**
 * Resolve Images reopened after an import, for Pending Images that remain.
 * The Source Document is gone by now, so it is asked for again — the same PDF
 * gives the same tags, so the assistant's numbers still find their pictures —
 * or a picture is uploaded without one.
 */
export function ResolveImagesDialog({
  occurrences,
  onClose,
  onResolve,
}: {
  occurrences: readonly PendingImageOccurrence[]
  onClose: () => void
  /** Store the chosen pictures, by occurrence key. */
  onResolve: (pictures: PendingImageResolution) => Promise<void>
}) {
  const [source, setSource] = useState<ResolvingSource | null>(null)
  const [resolutions, setResolutions] = useState<Resolutions>(new Map())
  const [filling, setFilling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialog = useRef<HTMLDivElement>(null)


  const supply = async (file: File) => {
    setError(null)
    setFilling(true)
    try {
      const { readSourceDocument } = await import('./source-file')
      const next = await readSourceDocument(file)
      setSource(next)
      const filled = await prefilledPictures(occurrences.filter(({ key }) => !resolutions.has(key)), next)
      setResolutions((current) => new Map([...filled, ...current]))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That PDF could not be read.')
    } finally {
      setFilling(false)
    }
  }

  const chosen = resolutionOf(resolutions, occurrences)
  const done = async () => {
    setSaving(true)
    setError(null)
    try {
      await onResolve(chosen)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The pictures could not be saved.')
      setSaving(false)
    }
  }

  return (
    <>
      <Modal title={"Resolve Images"} onClose={onClose} busy={saving} ref={dialog} className="bank-import-dialog bank-import-dialog--resolve resolve-images-dialog"   aria-label="Resolve Images">
        {error && <p className="home-error" role="alert">{error}</p>}
        <div className="bank-import-resolve">
          <ResolveImages
            occurrences={occurrences}
            source={source}
            resolutions={resolutions}
            onChange={setResolutions}
            onSourceFile={(file) => void supply(file)}
            filling={filling}
          />
        </div>
        <footer className="dialog-actions">
          <Button variant="outline" type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button variant="default" type="button" className="primary-button" disabled={saving || filling || chosen.size === 0} onClick={() => void done()}>
            {saving ? 'Saving…' : 'Use these pictures'}
          </Button>
        </footer>
      </Modal>
    </>
  )
}
