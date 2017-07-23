--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.3
-- Dumped by pg_dump version 9.6.3

-- Started on 2017-07-23 00:39:50

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 1 (class 3079 OID 12393)
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- TOC entry 2144 (class 0 OID 0)
-- Dependencies: 1
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- TOC entry 187 (class 1259 OID 24647)
-- Name: ais_record; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE ais_record (
    _id character varying(64) NOT NULL,
    mmsi integer NOT NULL,
    report_time timestamp with time zone NOT NULL,
    longlat point NOT NULL,
    cog numeric(4,1),
    sog numeric(4,1),
    navstat smallint,
    dest character varying(128),
    eta character varying(16)
);


ALTER TABLE ais_record OWNER TO postgres;

--
-- TOC entry 185 (class 1259 OID 24591)
-- Name: upload_status; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE upload_status (
    upload_time timestamp with time zone NOT NULL,
    complete boolean NOT NULL,
    error character varying(512),
    record_count integer,
    hit_rate numeric(4,2),
    process_duration smallint,
    db_duration smallint
);


ALTER TABLE upload_status OWNER TO postgres;

--
-- TOC entry 186 (class 1259 OID 24599)
-- Name: vessel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE vessel (
    mmsi integer NOT NULL,
    imo integer,
    name character varying(128),
    callsign character varying(32),
    type smallint,
    a smallint,
    b smallint,
    c smallint,
    d smallint,
    draught smallint
);


ALTER TABLE vessel OWNER TO postgres;

--
-- TOC entry 2018 (class 2606 OID 24651)
-- Name: ais_record ais_record_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY ais_record
    ADD CONSTRAINT ais_record_pkey PRIMARY KEY (_id);


--
-- TOC entry 2014 (class 2606 OID 24598)
-- Name: upload_status upload_status_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY upload_status
    ADD CONSTRAINT upload_status_pkey PRIMARY KEY (upload_time);


--
-- TOC entry 2016 (class 2606 OID 24603)
-- Name: vessel vessel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY vessel
    ADD CONSTRAINT vessel_pkey PRIMARY KEY (mmsi);


--
-- TOC entry 2019 (class 1259 OID 24697)
-- Name: report_time_mmsi_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX report_time_mmsi_idx ON ais_record USING btree (report_time, mmsi);


--
-- TOC entry 2143 (class 0 OID 0)
-- Dependencies: 3
-- Name: public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO "geoViz_viewer";
GRANT USAGE ON SCHEMA public TO ais_uploader;


--
-- TOC entry 2145 (class 0 OID 0)
-- Dependencies: 187
-- Name: ais_record; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE ais_record TO ais_uploader;
GRANT SELECT ON TABLE ais_record TO "geoViz_viewer";


--
-- TOC entry 2146 (class 0 OID 0)
-- Dependencies: 185
-- Name: upload_status; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE upload_status TO ais_uploader;
GRANT SELECT ON TABLE upload_status TO "geoViz_viewer";


--
-- TOC entry 2147 (class 0 OID 0)
-- Dependencies: 186
-- Name: vessel; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,UPDATE ON TABLE vessel TO ais_uploader;
GRANT SELECT ON TABLE vessel TO "geoViz_viewer";


--
-- TOC entry 1660 (class 826 OID 24578)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES  FROM postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,UPDATE ON TABLES  TO ais_uploader;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES  TO "geoViz_viewer";


-- Completed on 2017-07-23 00:39:56

--
-- PostgreSQL database dump complete
--

