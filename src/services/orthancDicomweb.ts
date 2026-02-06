import type { Instance, Series, Study } from '../types/dicom';

const configuredBaseUrl = import.meta.env.VITE_DICOMWEB_BASE_URL ?? '/dicom-web';
const configuredOrthancRestBase = import.meta.env.VITE_ORTHANC_REST_BASE ?? '/orthanc';
const USERNAME = import.meta.env.VITE_DICOMWEB_USERNAME ?? 'admin';
const PASSWORD = import.meta.env.VITE_DICOMWEB_PASSWORD ?? 'sonocloud2024';
const DICOMWEB_BASE_URL = configuredBaseUrl.endsWith('/')
  ? configuredBaseUrl.slice(0, -1)
  : configuredBaseUrl;
const ORTHANC_REST_BASE = configuredOrthancRestBase.endsWith('/')
  ? configuredOrthancRestBase.slice(0, -1)
  : configuredOrthancRestBase;
const resolvedBaseUrl =
  typeof window !== 'undefined' && DICOMWEB_BASE_URL.startsWith('/')
    ? `${window.location.origin}${DICOMWEB_BASE_URL}`
    : DICOMWEB_BASE_URL;
const resolvedOrthancRestBase =
  typeof window !== 'undefined' && ORTHANC_REST_BASE.startsWith('/')
    ? `${window.location.origin}${ORTHANC_REST_BASE}`
    : ORTHANC_REST_BASE;

const authHeader = `Basic ${btoa(`${USERNAME}:${PASSWORD}`)}`;

export type DicomTag = {
  Value?: Array<string | number | { Alphabetic?: string }>;
};

export type DicomEntity = Record<string, DicomTag>;

export type WadorsImageEntry = {
  imageId: string;
  metadata: DicomEntity;
};

type OrthancErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'NETWORK_OR_CORS' | 'HTTP';

export class OrthancClientError extends Error {
  code: OrthancErrorCode;
  status?: number;

  constructor(code: OrthancErrorCode, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const tagValue = (entity: DicomEntity, tag: string): string => {
  const value = entity[tag]?.Value?.[0];
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return value.Alphabetic ?? '';
};

const toDate = (rawDate: string): string => {
  if (!rawDate || rawDate.length !== 8) return rawDate || '-';
  const year = rawDate.slice(0, 4);
  const month = rawDate.slice(4, 6);
  const day = rawDate.slice(6, 8);
  return `${year}-${month}-${day}`;
};

const tagNumber = (entity: DicomEntity, tag: string): number | undefined => {
  const value = entity[tag]?.Value?.[0];
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const fetchDicom = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${DICOMWEB_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/dicom+json',
        Authorization: authHeader,
      },
    });
  } catch {
    throw new OrthancClientError(
      'NETWORK_OR_CORS',
      `Cannot reach Orthanc at ${DICOMWEB_BASE_URL}. Check Docker status, URL, and CORS/proxy settings.`
    );
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new OrthancClientError(
        'UNAUTHORIZED',
        'Orthanc authentication failed (401). Check username/password.',
        response.status
      );
    }
    if (response.status === 403) {
      throw new OrthancClientError(
        'FORBIDDEN',
        'Orthanc rejected this request (403). Check permissions.',
        response.status
      );
    }
    if (response.status === 404) {
      throw new OrthancClientError(
        'NOT_FOUND',
        'DICOMweb endpoint not found (404). Verify base URL ends with /dicom-web.',
        response.status
      );
    }
    throw new OrthancClientError(
      'HTTP',
      `Orthanc DICOMweb request failed (${response.status}).`,
      response.status
    );
  }

  return (await response.json()) as T;
};

const fetchImageBlob = async (url: string): Promise<Blob | null> => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/jpeg, image/png;q=0.9, */*;q=0.8',
        Authorization: authHeader,
      },
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return blob;
  } catch {
    return null;
  }
};

const fetchOrthanc = async (path: string, init?: RequestInit): Promise<Response | null> => {
  try {
    return await fetch(`${ORTHANC_REST_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return null;
  }
};

const fetchOrthancJson = async <T>(path: string, init?: RequestInit): Promise<T | null> => {
  const response = await fetchOrthanc(path, init);
  if (!response || !response.ok) return null;
  return (await response.json()) as T;
};

export const orthancClient = {
  async findOrthancStudyId(studyInstanceUID: string): Promise<string | null> {
    const rows = await fetchOrthancJson<Array<string | { ID?: string }>>('/tools/find', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Level: 'Study',
        Query: {
          StudyInstanceUID: studyInstanceUID,
        },
      }),
    });

    if (!rows?.length) return null;
    const first = rows[0];
    if (typeof first === 'string') return first;
    return first.ID ?? null;
  },

  async getOrthancPreviewBlobUrlByStudyUID(studyInstanceUID: string): Promise<string | null> {
    const orthancStudyId = await this.findOrthancStudyId(studyInstanceUID);
    if (!orthancStudyId) return null;

    type StudyResource = { Series?: string[] };
    type SeriesResource = { Instances?: string[] };

    const studyResource = await fetchOrthancJson<StudyResource>(
      `/studies/${encodeURIComponent(orthancStudyId)}`
    );
    const seriesIds = studyResource?.Series ?? [];
    if (!seriesIds.length) return null;

    for (const orthancSeriesId of seriesIds) {
      const seriesResource = await fetchOrthancJson<SeriesResource>(
        `/series/${encodeURIComponent(orthancSeriesId)}`
      );
      const instanceIds = seriesResource?.Instances ?? [];
      const orthancInstanceId = instanceIds[0];
      if (!orthancInstanceId) {
        continue;
      }

      const previewCandidates = [
        `${resolvedOrthancRestBase}/instances/${encodeURIComponent(orthancInstanceId)}/preview`,
        `${resolvedOrthancRestBase}/instances/${encodeURIComponent(orthancInstanceId)}/image-uint8`,
      ];

      for (const url of previewCandidates) {
        const blob = await fetchImageBlob(url);
        if (!blob) continue;
        return URL.createObjectURL(blob);
      }
    }

    return null;
  },

  async searchStudies(searchTerm: string): Promise<Study[]> {
    const params = new URLSearchParams({ limit: '100' });
    params.append('includefield', 'StudyInstanceUID');
    params.append('includefield', 'PatientName');
    params.append('includefield', 'StudyDate');
    params.append('includefield', 'StudyID');
    params.append('includefield', 'ModalitiesInStudy');
    params.append('includefield', 'NumberOfStudyRelatedSeries');
    params.append('includefield', 'NumberOfStudyRelatedInstances');

    if (searchTerm.trim()) {
      params.set('PatientName', `${searchTerm.trim()}*`);
    }

    const rows = await fetchDicom<DicomEntity[]>(`/studies?${params.toString()}`);

    return rows.map((row) => ({
      studyInstanceUID: tagValue(row, '0020000D'),
      studyId: tagValue(row, '00200010') || '-',
      patientName: tagValue(row, '00100010') || 'Unknown',
      studyDate: toDate(tagValue(row, '00080020')),
      modality: tagValue(row, '00080061') || '-',
      seriesCount: Number(tagValue(row, '00201206')) || 0,
      instanceCount: Number(tagValue(row, '00201208')) || 0,
      thumbnailUrl: undefined,
    }));
  },

  async getSeries(studyInstanceUID: string): Promise<Series[]> {
    const params = new URLSearchParams();
    params.append('includefield', 'SeriesInstanceUID');
    params.append('includefield', 'Modality');
    params.append('includefield', 'NumberOfSeriesRelatedInstances');

    const rows = await fetchDicom<DicomEntity[]>(
      `/studies/${encodeURIComponent(studyInstanceUID)}/series?${params.toString()}`
    );

    return rows.map((row) => ({
      seriesInstanceUID: tagValue(row, '0020000E'),
      modality: tagValue(row, '00080060') || '-',
      instanceCount: Number(tagValue(row, '00201209')) || 0,
    }));
  },

  async getInstances(
    studyInstanceUID: string,
    seriesInstanceUID: string,
    options?: { limit?: number }
  ): Promise<Instance[]> {
    const params = new URLSearchParams();
    params.append('includefield', 'SOPInstanceUID');
    params.append('includefield', 'NumberOfFrames');
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }

    const rows = await fetchDicom<DicomEntity[]>(
      `/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(seriesInstanceUID)}/instances?${params.toString()}`
    );

    return rows
      .map((row) => ({
        sopInstanceUID: tagValue(row, '00080018'),
        numberOfFrames: Number(tagValue(row, '00280008')) || 1,
        seriesInstanceUID,
      }))
      .filter((row) => Boolean(row.sopInstanceUID));
  },

  buildRenderedImageUrl(
    studyUID: string,
    seriesUID: string,
    sopInstanceUID: string,
    frame?: number,
    withViewport = true
  ): string {
    const renderedUrl =
      frame && frame > 0
        ? `${resolvedBaseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopInstanceUID)}/frames/${frame}/rendered`
        : `${resolvedBaseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopInstanceUID)}/rendered`;
    return withViewport ? `${renderedUrl}?viewport=128,128` : renderedUrl;
  },

  async getStudyThumbnailBlobUrl(studyInstanceUID: string): Promise<string | null> {
    const previewUrl = await this.getOrthancPreviewBlobUrlByStudyUID(studyInstanceUID);
    if (previewUrl) {
      return previewUrl;
    }

    const series = await this.getSeries(studyInstanceUID);
    if (!series.length) return null;

    const prioritizedSeries = [...series].sort((a, b) => b.instanceCount - a.instanceCount);
    for (const row of prioritizedSeries) {
      const instances = await this.getInstances(studyInstanceUID, row.seriesInstanceUID, { limit: 1 });
      const firstInstance = instances.find((item) => Boolean(item.sopInstanceUID));
      if (!firstInstance) {
        continue;
      }

      const frame = Math.max(firstInstance.numberOfFrames, 1) > 1 ? 1 : undefined;
      const candidateUrls = [
        this.buildRenderedImageUrl(
          studyInstanceUID,
          row.seriesInstanceUID,
          firstInstance.sopInstanceUID,
          frame,
          true
        ),
        this.buildRenderedImageUrl(
          studyInstanceUID,
          row.seriesInstanceUID,
          firstInstance.sopInstanceUID,
          undefined,
          true
        ),
        this.buildRenderedImageUrl(
          studyInstanceUID,
          row.seriesInstanceUID,
          firstInstance.sopInstanceUID,
          frame,
          false
        ),
        this.buildRenderedImageUrl(
          studyInstanceUID,
          row.seriesInstanceUID,
          firstInstance.sopInstanceUID,
          undefined,
          false
        ),
      ];

      for (const url of candidateUrls) {
        const blob = await fetchImageBlob(url);
        if (!blob) continue;
        return URL.createObjectURL(blob);
      }
    }

    return null;
  },

  isDisplayableImageMetadata(metadata: DicomEntity): boolean {
    const sopInstanceUID = tagValue(metadata, '00080018');
    const rows = tagNumber(metadata, '00280010');
    const columns = tagNumber(metadata, '00280011');
    const samplesPerPixel = tagNumber(metadata, '00280002');
    const bitsAllocated = tagNumber(metadata, '00280100');

    return Boolean(
      sopInstanceUID &&
        rows &&
        columns &&
        rows > 0 &&
        columns > 0 &&
        samplesPerPixel &&
        samplesPerPixel > 0 &&
        bitsAllocated &&
        bitsAllocated > 0
    );
  },

  buildWadorsEntriesFromMetadata(
    studyUID: string,
    seriesUID: string,
    metadataList: DicomEntity[]
  ): WadorsImageEntry[] {
    const entries: WadorsImageEntry[] = [];

    metadataList.forEach((metadata) => {
      if (!this.isDisplayableImageMetadata(metadata)) {
        return;
      }

      const sopInstanceUID = tagValue(metadata, '00080018');
      const numberOfFrames = Math.max(tagNumber(metadata, '00280008') ?? 1, 1);

      for (let frameIndex = 1; frameIndex <= numberOfFrames; frameIndex += 1) {
        entries.push({
          imageId: `wadors:${resolvedBaseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(sopInstanceUID)}/frames/${frameIndex}`,
          metadata,
        });
      }
    });

    return entries;
  },

  async getSeriesWadorsEntries(studyInstanceUID: string, seriesInstanceUID: string): Promise<WadorsImageEntry[]> {
    const params = new URLSearchParams();
    params.append('includefield', 'SOPInstanceUID');
    params.append('includefield', 'SeriesInstanceUID');
    params.append('includefield', 'NumberOfFrames');
    params.append('includefield', 'Rows');
    params.append('includefield', 'Columns');
    params.append('includefield', 'SamplesPerPixel');
    params.append('includefield', 'PhotometricInterpretation');
    params.append('includefield', 'BitsAllocated');
    params.append('includefield', 'BitsStored');
    params.append('includefield', 'PixelRepresentation');
    params.append('includefield', 'PlanarConfiguration');

    const rows = await fetchDicom<DicomEntity[]>(
      `/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(seriesInstanceUID)}/instances?${params.toString()}`
    );

    return this.buildWadorsEntriesFromMetadata(studyInstanceUID, seriesInstanceUID, rows);
  },

  async getSeriesMetadata(studyInstanceUID: string, seriesInstanceUID: string): Promise<DicomEntity[]> {
    return fetchDicom<DicomEntity[]>(
      `/studies/${encodeURIComponent(studyInstanceUID)}/series/${encodeURIComponent(seriesInstanceUID)}/metadata`
    );
  },

  async getStudyWadorsEntries(studyInstanceUID: string): Promise<WadorsImageEntry[]> {
    const params = new URLSearchParams();
    params.append('includefield', 'SOPInstanceUID');
    params.append('includefield', 'SeriesInstanceUID');
    params.append('includefield', 'NumberOfFrames');
    params.append('includefield', 'Rows');
    params.append('includefield', 'Columns');
    params.append('includefield', 'SamplesPerPixel');
    params.append('includefield', 'PhotometricInterpretation');
    params.append('includefield', 'BitsAllocated');
    params.append('includefield', 'BitsStored');
    params.append('includefield', 'PixelRepresentation');
    params.append('includefield', 'PlanarConfiguration');

    const rows = await fetchDicom<DicomEntity[]>(
      `/studies/${encodeURIComponent(studyInstanceUID)}/instances?${params.toString()}`
    );

    const grouped = new Map<string, DicomEntity[]>();
    rows.forEach((row) => {
      const seriesUID = tagValue(row, '0020000E');
      if (!seriesUID) return;
      const list = grouped.get(seriesUID) ?? [];
      list.push(row);
      grouped.set(seriesUID, list);
    });

    const entries: WadorsImageEntry[] = [];
    grouped.forEach((metadataList, seriesUID) => {
      entries.push(...this.buildWadorsEntriesFromMetadata(studyInstanceUID, seriesUID, metadataList));
    });

    return entries;
  },

  async getStudyInstances(studyInstanceUID: string): Promise<Instance[]> {
    const params = new URLSearchParams();
    params.append('includefield', 'SOPInstanceUID');
    params.append('includefield', 'SeriesInstanceUID');
    params.append('includefield', 'NumberOfFrames');

    const rows = await fetchDicom<DicomEntity[]>(
      `/studies/${encodeURIComponent(studyInstanceUID)}/instances?${params.toString()}`
    );

    return rows
      .map((row) => ({
        sopInstanceUID: tagValue(row, '00080018'),
        seriesInstanceUID: tagValue(row, '0020000E'),
        numberOfFrames: Number(tagValue(row, '00280008')) || 1,
      }))
      .filter((row) => Boolean(row.sopInstanceUID) && Boolean(row.seriesInstanceUID));
  },

  buildWadorsImageIds(studyUID: string, seriesUID: string, instances: Instance[]): string[] {
    const imageIds: string[] = [];

    instances.forEach((instance) => {
      const totalFrames = Math.max(instance.numberOfFrames, 1);
      for (let frameIndex = 1; frameIndex <= totalFrames; frameIndex += 1) {
        imageIds.push(
          `wadors:${resolvedBaseUrl}/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(instance.sopInstanceUID)}/frames/${frameIndex}`
        );
      }
    });

    return imageIds;
  },

  buildWadorsImageIdsFromStudyInstances(studyUID: string, instances: Instance[]): string[] {
    const groupedBySeries = new Map<string, Instance[]>();

    instances.forEach((instance) => {
      if (!instance.seriesInstanceUID) return;
      const list = groupedBySeries.get(instance.seriesInstanceUID) ?? [];
      list.push(instance);
      groupedBySeries.set(instance.seriesInstanceUID, list);
    });

    const imageIds: string[] = [];
    groupedBySeries.forEach((items, seriesUID) => {
      imageIds.push(...this.buildWadorsImageIds(studyUID, seriesUID, items));
    });

    return imageIds;
  },

  getBaseUrl(): string {
    return DICOMWEB_BASE_URL;
  },

  getResolvedBaseUrl(): string {
    return resolvedBaseUrl;
  },

  getResolvedOrthancRestBase(): string {
    return resolvedOrthancRestBase;
  },

  getReadableError(error: unknown): string {
    if (error instanceof OrthancClientError) {
      return error.message;
    }
    return 'Unknown DICOMweb error. Check browser console for details.';
  },
};
